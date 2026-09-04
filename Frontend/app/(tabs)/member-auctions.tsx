import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { Colors, Shadows } from '../../lib/constants';
import { formatPaise } from '../../lib/hooks/useDashboard';
import { useMemberSession } from '../../lib/MemberSessionContext';

// ─── Types ───────────────────────────────────────────────────
type BidRow = {
  id: string;
  bid_amount: number;
  placed_at: string;
  is_retracted: boolean;
};

type AuctionDetail = {
  id: string;
  chit_group_id: string;
  auction_number: number | null;
  scheduled_at: string;
  closes_at: string | null;
  status: string;
  min_bid: number;
  max_bid: number | null;
  current_bid: number; // highest discount bid so far
  chit_group: { name: string; value: number; duration_months: number } | null;
  is_joined: boolean;
  my_bids: BidRow[]; // all bids by this member, latest first
};

// ─── Hook: live auctions the member is part of ───────────────
function useAuctionsList(memberId: string | null) {
  return useQuery<AuctionDetail[]>({
    queryKey: ['auctions-list', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];

      const { data: memberGroups, error: groupError } = await supabase
        .from('chit_members')
        .select('chit_group_id')
        .eq('customer_id', memberId);
      if (groupError) throw groupError;

      const groupIds = (memberGroups || []).map((r: any) => r.chit_group_id);
      if (groupIds.length === 0) return [];

      const { data, error } = await supabase
        .from('auctions')
        .select('id, chit_group_id, auction_number, scheduled_at, closes_at, status, min_bid, max_bid, current_bid, chit_group:chit_groups(name, value, duration_months)')
        .in('chit_group_id', groupIds)
        .eq('status', 'live')
        .order('scheduled_at', { ascending: true })
        .limit(20);
      if (error) throw error;

      const auctions = (data ?? []) as unknown as AuctionDetail[];
      if (auctions.length === 0) return [];

      const auctionIds = auctions.map(a => a.id);

      const [{ data: joinedRows }, { data: bidRows }] = await Promise.all([
        supabase.from('auction_participants').select('auction_id').eq('customer_id', memberId).in('auction_id', auctionIds),
        supabase.from('auction_bids').select('id, auction_id, bid_amount, placed_at, is_retracted').eq('customer_id', memberId).in('auction_id', auctionIds).order('placed_at', { ascending: false }),
      ]);

      const joinedSet = new Set((joinedRows || []).map((r: any) => r.auction_id));
      const bidsByAuction: Record<string, BidRow[]> = {};
      for (const row of (bidRows || []) as any[]) {
        bidsByAuction[row.auction_id] = bidsByAuction[row.auction_id] || [];
        bidsByAuction[row.auction_id].push({ id: row.id, bid_amount: row.bid_amount, placed_at: row.placed_at, is_retracted: row.is_retracted });
      }

      return auctions.map(a => ({
        ...a,
        is_joined: joinedSet.has(a.id),
        my_bids: bidsByAuction[a.id] || [],
      }));
    },
    refetchInterval: 20000,
  });
}

// ─── Mutations ────────────────────────────────────────────────
function useJoinAuction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auctionId, customerId }: { auctionId: string; customerId: string }) => {
      const { data: existing } = await supabase.from('auction_participants').select('id').eq('auction_id', auctionId).eq('customer_id', customerId).maybeSingle();
      if (existing) return;
      const { error } = await supabase.from('auction_participants').insert({ auction_id: auctionId, customer_id: customerId });
      if (error) {
        if (error.message?.includes('not part of this chit group'))
          throw new Error('You are not enrolled in this chit group. Contact the admin.');
        throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auctions-list'] }),
    onError: (e: Error) => Alert.alert('Cannot Join', e.message),
  });
}

function usePlaceBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auctionId, amount, customerId, bidderName }: { auctionId: string; amount: number; customerId: string; bidderName?: string }) => {
      const { error } = await supabase.from('auction_bids').insert({
        auction_id: auctionId,
        customer_id: customerId,
        bid_amount: amount,
        bidder_name: bidderName || null,
        is_retracted: false,
      });
      // current_bid is updated automatically by the DB trigger trg_update_current_highest_bid
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auctions-list'] }),
    onError: (e: Error) => Alert.alert('Bid Failed', e.message),
  });
}

function useRetractBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bidId, auctionId }: { bidId: string; auctionId: string }) => {
      // 1. Mark the bid as retracted — requires UPDATE policy (027_bid_retract_policy.sql)
      const { error, data } = await supabase
        .from('auction_bids')
        .update({ is_retracted: true, retracted_at: new Date().toISOString() })
        .eq('id', bidId)
        .select('id')
        .maybeSingle();

      if (error) throw new Error(error.message);

      // Verify the update actually applied (RLS could silently block if policy missing)
      if (!data) {
        throw new Error('Retract failed — bid not found or permission denied. Make sure migration 027 has been run in Supabase.');
      }

      // auctions.current_bid is recalculated atomically by the DB trigger
      // trg_recalc_current_bid_after_retract (032). Doing it here in two
      // round-trips raced concurrent bids/retracts and could leave a stale value.
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auctions-list'] }),
    onError: (e: Error) => Alert.alert('Retract Failed', e.message),
  });
}

// ─── Live Pulse Dot ───────────────────────────────────────────
function LiveDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={s.liveDotWrap}>
      <Animated.View style={[s.liveDotPing, { opacity: anim }]} />
      <View style={s.liveDot} />
    </View>
  );
}

// ─── Countdown ────────────────────────────────────────────────
function Countdown({ targetAt }: { targetAt: string }) {
  const calc = () => {
    const diff = new Date(targetAt).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      mins: Math.floor((diff % 3600000) / 60000),
      secs: Math.floor((diff % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, [targetAt]);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={s.countdownRow}>
      {t.days > 0 && <><Text style={s.countdownNum}>{pad(t.days)}</Text><Text style={s.countdownColon}>d </Text></>}
      <Text style={s.countdownNum}>{pad(t.hours)}</Text><Text style={s.countdownColon}>:</Text>
      <Text style={s.countdownNum}>{pad(t.mins)}</Text><Text style={s.countdownColon}>:</Text>
      <Text style={s.countdownNum}>{pad(t.secs)}</Text>
    </View>
  );
}

// ─── Auction Card ─────────────────────────────────────────────
function AuctionCard({ auction }: { auction: AuctionDetail }) {
  const { memberId, memberProfile } = useMemberSession();
  const { mutate: placeBid, isPending: bidding } = usePlaceBid();
  const { mutate: joinAuction, isPending: joining } = useJoinAuction();
  const { mutate: retractBid, isPending: retracting } = useRetractBid();
  const [bidAmount, setBidAmount] = useState('');
  // Live countdown for the 2-minute retract window — ticks every second
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const group = auction.chit_group;
  const groupValue = group?.value ?? 0; // in paise
  const isLive = auction.status === 'live';
  const isExpired = isLive && auction.closes_at ? new Date(auction.closes_at).getTime() <= Date.now() : false;
  const minBid = auction.min_bid || 0;
  const maxBid = auction.max_bid && auction.max_bid > 0 ? auction.max_bid : groupValue;
  const currentHighest = auction.current_bid || 0; // highest discount bid by anyone

  // My active bids (not retracted), sorted latest first
  const myActiveBids = auction.my_bids.filter(b => !b.is_retracted);
  const myBestBid = myActiveBids.length > 0 ? myActiveBids[0].bid_amount : 0; // latest = highest since revisions are forced upward
  const myLatestBid = myActiveBids.length > 0 ? myActiveBids[0] : null;
  const amIWinning = myBestBid > 0 && myBestBid >= currentHighest;

  // Retract window: 2 minutes from placing the latest bid — uses live `now` ticker
  const RETRACT_WINDOW_MS = 2 * 60 * 1000;
  const elapsedSinceLatest = myLatestBid ? now - new Date(myLatestBid.placed_at).getTime() : Infinity;
  const canRetract = elapsedSinceLatest < RETRACT_WINDOW_MS;
  const retractSecsLeft = canRetract ? Math.ceil((RETRACT_WINDOW_MS - elapsedSinceLatest) / 1000) : 0;

  // Prize the current winner would receive = Group Value − their discount
  const currentWinnerPrize = Math.max(0, groupValue - currentHighest);

  const handleJoin = () => {
    if (!memberId) { Alert.alert('Login Required', 'Please log in first.'); return; }
    joinAuction({ auctionId: auction.id, customerId: memberId });
  };

  const handleBid = () => {
    if (!memberId) { Alert.alert('Login Required', 'Please log in to bid.'); return; }
    if (!isLive || isExpired) { Alert.alert('Auction Closed', 'This auction is no longer accepting bids.'); return; }
    if (!auction.is_joined) { Alert.alert('Not Joined', 'Join the auction first.'); return; }

    const amountPaise = Math.round(Number(bidAmount) * 100);
    if (Number.isNaN(amountPaise) || amountPaise <= 0) { Alert.alert('Invalid Amount', 'Enter a valid discount amount in rupees.'); return; }
    if (amountPaise < minBid) { Alert.alert('Too Low', `Minimum discount is ${formatPaise(minBid)}.`); return; }
    if (amountPaise > maxBid) { Alert.alert('Too High', `Maximum discount is ${formatPaise(maxBid)}.`); return; }

    // Must beat the GLOBAL highest bid — not the member's own previous bid
    if (currentHighest > 0 && amountPaise <= currentHighest) {
      Alert.alert(
        'Must Beat Current Leader',
        `The current highest bid is ${formatPaise(currentHighest)}. Your bid must be above that to take the lead.`
      );
      return;
    }

    const prizeIfWin = Math.max(0, groupValue - amountPaise);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Confirm Your Bid',
      `Discount offered: ${formatPaise(amountPaise)}\nIf you win, you receive: ${formatPaise(prizeIfWin)}\n\nYou can retract within 2 minutes of placing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Place Bid',
          onPress: () => {
            placeBid({ auctionId: auction.id, amount: amountPaise, customerId: memberId, bidderName: memberProfile?.full_name });
            setBidAmount('');
          },
        },
      ]
    );
  };

  const handleRetract = () => {
    if (!myLatestBid || !canRetract) return;
    Alert.alert(
      'Retract Bid?',
      `This will remove your bid of ${formatPaise(myLatestBid.bid_amount)}.\n\nYou have ${retractSecsLeft}s left in the retract window.\n\nAfter retracting you can place a new bid.`,
      [
        { text: 'Keep Bid', style: 'cancel' },
        {
          text: 'Retract',
          style: 'destructive',
          onPress: () => retractBid({ bidId: myLatestBid.id, auctionId: auction.id }),
        },
      ]
    );
  };

  return (
    <View style={[s.auctionCard, amIWinning && s.auctionCardWinning]}>
      {/* Header */}
      <View style={s.auctionCardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isLive && <LiveDot />}
          <Text style={[s.liveLabel, { color: '#EF4444' }]}>LIVE AUCTION</Text>
        </View>
        {amIWinning && (
          <View style={s.winningBadge}>
            <Text style={s.winningBadgeText}>🏆 YOU'RE WINNING</Text>
          </View>
        )}
      </View>

      <Text style={s.auctionTitle}>{group?.name ?? 'Auction'}</Text>
      <Text style={s.auctionSub}>
        Chit Value: {formatPaise(groupValue)} · Month {auction.auction_number ?? '—'}/{group?.duration_months ?? '—'}
      </Text>

      {/* Stats card */}
      <View style={s.mainCard}>
        <View style={s.bidRow}>
          <View>
            <Text style={s.bidRowLabel}>CLOSES IN</Text>
            <Countdown targetAt={auction.closes_at ?? auction.scheduled_at} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.bidRowLabel}>HIGHEST DISCOUNT</Text>
            <Text style={s.currentBidAmt}>{currentHighest > 0 ? formatPaise(currentHighest) : '—'}</Text>
          </View>
        </View>

        {/* Progress: how much of the chit value has been offered as discount */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.min((currentHighest / (groupValue || 1)) * 100, 100)}%` as any }]} />
        </View>

        <View style={s.statsGrid}>
          <View>
            <Text style={s.statLabel}>MIN DISCOUNT</Text>
            <Text style={s.statVal}>{formatPaise(minBid)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.statLabel}>WINNER GETS</Text>
            <Text style={[s.statVal, { color: Colors.primary }]}>{formatPaise(currentWinnerPrize)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.statLabel}>MAX DISCOUNT</Text>
            <Text style={s.statVal}>{formatPaise(maxBid)}</Text>
          </View>
        </View>
      </View>

      {/* My current position */}
      {myBestBid > 0 && (
        <View style={[s.myBidBox, amIWinning ? s.myBidBoxWinning : s.myBidBoxLosing]}>
          <View style={{ flex: 1 }}>
            <Text style={s.myBidLabel}>YOUR CURRENT BID</Text>
            <Text style={[s.myBidAmt, { color: amIWinning ? '#10B981' : '#F59E0B' }]}>{formatPaise(myBestBid)}</Text>
            <Text style={s.myBidSub}>You'd receive {formatPaise(Math.max(0, groupValue - myBestBid))} if you win</Text>
          </View>
          {amIWinning
            ? <Text style={s.positionTag}>LEADING 🏆</Text>
            : <Text style={[s.positionTag, { color: '#F59E0B' }]}>OUTBID — BID HIGHER</Text>
          }
        </View>
      )}

      {/* Join / Bid section */}
      {!auction.is_joined ? (
        <TouchableOpacity style={[s.joinBtn]} onPress={handleJoin} disabled={joining} activeOpacity={0.85}>
          <Text style={s.joinBtnText}>{joining ? 'Joining…' : 'Join Auction to Bid'}</Text>
        </TouchableOpacity>
      ) : isExpired ? (
        <View style={[s.joinBtn, { backgroundColor: '#94A3B8' }]}>
          <Text style={s.joinBtnText}>Auction Closed</Text>
        </View>
      ) : (
        <View style={s.bidInputCard}>
          <Text style={s.bidInputLabel}>
            {currentHighest > 0
              ? `Enter Discount Amount (₹) — must beat ${formatPaise(currentHighest)}`
              : 'Enter Discount Amount (₹)'}
          </Text>
          <TextInput
            style={s.bidInput}
            keyboardType="numeric"
            placeholder={currentHighest > 0
              ? `Above ₹${(currentHighest / 100).toLocaleString('en-IN')}`
              : `e.g. ₹${((minBid || 10000) / 100).toLocaleString('en-IN')}`}
            placeholderTextColor="#94A3B8"
            value={bidAmount}
            onChangeText={setBidAmount}
          />
          <TouchableOpacity
            style={[s.placeBidBtn, (bidding || isExpired) && { opacity: 0.6 }]}
            onPress={handleBid}
            disabled={bidding || isExpired}
            activeOpacity={0.85}
          >
            <Text style={s.placeBidLeft}>{bidding ? 'Placing…' : amIWinning ? 'Raise My Bid' : myBestBid > 0 ? 'Bid Higher' : 'Place Bid'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.placeBidRight}>
                {bidAmount ? `Win ₹${Math.max(0, (groupValue / 100) - Number(bidAmount)).toLocaleString('en-IN')}` : 'Highest Wins'}
              </Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill={Colors.primary}>
                <Path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
              </Svg>
            </View>
          </TouchableOpacity>

          {/* Retract option — only within 2 min window, shows live countdown */}
          {myLatestBid && (
            <TouchableOpacity
              style={[s.retractBtn, (!canRetract || retracting) && s.retractBtnDisabled]}
              onPress={handleRetract}
              disabled={!canRetract || retracting}
            >
              {canRetract ? (
                <Text style={s.retractBtnText}>
                  {retracting
                    ? 'Retracting…'
                    : `↩  Retract bid of ${formatPaise(myLatestBid.bid_amount)}  ·  ${retractSecsLeft}s left`}
                </Text>
              ) : (
                <Text style={s.retractBtnExpired}>🔒 Retract window closed (2 min elapsed)</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* My bid history */}
      <View style={s.feedSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={s.feedTitle}>My Bid History</Text>
          <Text style={s.feedCount}>{auction.my_bids.length} BID{auction.my_bids.length !== 1 ? 'S' : ''}</Text>
        </View>
        {auction.my_bids.length === 0 ? (
          <Text style={s.emptySub}>No bids placed yet.</Text>
        ) : (
          auction.my_bids.map((b, i) => (
            <View key={b.id} style={[s.feedRow, b.is_retracted && { opacity: 0.45 }]}>
              <View style={[s.feedAvatar, b.is_retracted && { backgroundColor: '#F1F5F9' }]}>
                <Text style={s.feedAvatarTxt}>{b.is_retracted ? '↩' : 'ME'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.feedName, b.is_retracted && { textDecorationLine: 'line-through', color: '#94A3B8' }]}>
                  {formatPaise(b.bid_amount)}
                </Text>
                <Text style={s.feedTime}>
                  {new Date(b.placed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={[s.feedAmt, { color: b.is_retracted ? '#94A3B8' : Colors.primary }]}>
                {b.is_retracted ? 'Retracted' : i === 0 ? 'Active' : 'Superseded'}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function AuctionsScreen() {
  const { memberId, isLoading: sessionLoading } = useMemberSession();
  const { data: auctions, isLoading } = useAuctionsList(memberId);
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['auctions-list'] });
    const ch = supabase
      .channel('member-auctions-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_bids' }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.appBar}>
        <Text style={s.appBarTitle}>Live Auctions</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LiveDot />
          <Text style={s.liveCount}>{auctions?.length ?? 0} Live</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {sessionLoading || isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <Text style={{ fontSize: 32 }}>⚡</Text>
            <Text style={s.emptyTitle}>Loading…</Text>
          </View>
        ) : !memberId ? (
          <View style={s.emptyContainer}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={s.emptyTitle}>Sign in to view auctions</Text>
          </View>
        ) : !auctions || auctions.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={{ fontSize: 40 }}>🔨</Text>
            <Text style={s.emptyTitle}>No live auctions right now</Text>
            <Text style={s.emptySub}>The admin will start the next auction soon.</Text>
          </View>
        ) : (
          auctions.map(a => <AuctionCard key={a.id} auction={a} />)
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)', ...Shadows.subtle },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: -0.5 },
  liveCount: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#EF4444' },
  scroll: { padding: 20, gap: 20 },

  liveDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  liveDotPing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#EF4444' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },

  auctionCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, gap: 14, borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle },
  auctionCardWinning: { borderColor: '#10B981', borderWidth: 2 },
  auctionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5 },
  winningBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  winningBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#16A34A' },
  auctionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#0B1C30', letterSpacing: -0.5 },
  auctionSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748B' },

  mainCard: { backgroundColor: '#F8FAFC', borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bidRowLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  countdownNum: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: Colors.secondary, letterSpacing: -1 },
  countdownColon: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.secondary },
  currentBidAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#10B981', letterSpacing: -0.5 },
  progressTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 100 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  statVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },

  myBidBox: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  myBidBoxWinning: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  myBidBoxLosing: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  myBidLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', letterSpacing: 0.5 },
  myBidAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20 },
  myBidSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748B', marginTop: 2 },
  positionTag: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#10B981', textAlign: 'right' },

  joinBtn: { backgroundColor: '#0F766E', borderRadius: 18, height: 56, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FFFFFF' },

  bidInputCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  bidInputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B', letterSpacing: 0.4 },
  bidInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#0B1C30' },
  placeBidBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.secondary, borderRadius: 14, paddingHorizontal: 20, height: 56 },
  placeBidLeft: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.primary },
  placeBidRight: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.primary },
  retractBtn: { paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF5F5' },
  retractBtnDisabled: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  retractBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#EF4444' },
  retractBtnExpired: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8' },

  feedSection: { gap: 10 },
  feedTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },
  feedCount: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.primary, letterSpacing: 0.8 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  feedAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  feedAvatarTxt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#64748B' },
  feedName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  feedTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A3B8' },
  feedAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.primary, marginTop: 8 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});
