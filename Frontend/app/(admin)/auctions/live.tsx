import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../../components/AppLogo';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { apiPost } from '../../../lib/api';
import { isAuctionConfiguredUpcoming } from '../../../lib/auctionUtils';

export default function AdminLiveAuction() {
  const router = useRouter();
  const [auction, setAuction] = useState<any | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);
  const [timeLeft, setTimeLeft] = useState('--:--');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const auctionIdRef = useRef<string | null>(null);

  const fetchBids = async (auctionId: string) => {
    try {
      // Highest discount bid wins — sort descending, exclude retracted bids
      const { data } = await supabase
        .from('auction_bids')
        .select('*, customers(full_name)')
        .eq('auction_id', auctionId)
        .eq('is_retracted', false)
        .order('bid_amount', { ascending: false });

      if (!data) { setBids([]); return; }

      // Per member: keep only their most recent active bid (latest placed_at).
      // A member's latest bid IS their current standing — earlier bids are superseded.
      const latestPerMember = new Map<string, any>();
      // Data is sorted by bid_amount desc but we need latest per member.
      // Re-sort by placed_at desc first to find the most recent.
      const byTime = [...data].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
      for (const bid of byTime) {
        const key = bid.customer_id || bid.id;
        if (!latestPerMember.has(key)) {
          latestPerMember.set(key, bid); // first seen = most recent
        }
      }

      // Sort the leaderboard by bid_amount descending — highest discount = #1
      const leaderboard = Array.from(latestPerMember.values())
        .sort((a, b) => b.bid_amount - a.bid_amount);
      setBids(leaderboard);
    } catch (err) {
      console.error('Error fetching bids:', err);
    }
  };

  const startTimer = (closesAt: string | null, scheduledAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    // Always use closes_at; fallback to scheduled_at + 1hr only if closes_at is missing
    const endTime = closesAt
      ? new Date(closesAt).getTime()
      : new Date(scheduledAt).getTime() + 3600000;

    const tick = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setTimeLeft('00:00');
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        if (h > 0) {
          setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        } else {
          setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      }
    };
    tick(); // run immediately so there's no delay
    timerRef.current = setInterval(tick, 1000);
  };

  const fetchLiveAuction = async () => {
    try {
      const { data: liveAuction, error: liveError } = await supabase
        .from('auctions')
        .select('*, chit_groups(name, group_code, value, capacity)')
        .eq('status', 'live')
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single();

      if (liveError && liveError.code !== 'PGRST116') throw liveError;

      if (liveAuction?.id) {
        auctionIdRef.current = liveAuction.id;
        setAuction(liveAuction);
        fetchBids(liveAuction.id);
        startTimer(liveAuction.closes_at, liveAuction.scheduled_at);
        return;
      }

      // Fallback: next admin-configured upcoming only (never auto-generated placeholders)
      const { data: upcomingRows, error: upcomingError } = await supabase
        .from('auctions')
        .select('*, chit_groups(name, group_code, value, capacity)')
        .eq('status', 'upcoming')
        .gt('min_bid', 0)
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (upcomingError) throw upcomingError;
      const upcomingAuction = (upcomingRows || []).find(isAuctionConfiguredUpcoming) || null;
      auctionIdRef.current = upcomingAuction?.id || null;
      setAuction(upcomingAuction);
    } catch (err) {
      console.error('Error fetching live auction:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setup: fetch once + subscribe to real-time channels
  useEffect(() => {
    fetchLiveAuction();

    const bidsChannel = supabase
      .channel('live_bids')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auction_bids' }, () => {
        // Use ref to avoid stale closure
        if (auctionIdRef.current) fetchBids(auctionIdRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .subscribe();

    const auctionChannel = supabase
      .channel('auction_status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions' }, fetchLiveAuction)
      .subscribe();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(auctionChannel);
    };
  }, []); // Run once — no dependency on auction.id

  const handleDeclareWinner = async () => {
    if (!auction || bids.length === 0) {
      Alert.alert('No Bids', 'Cannot declare a winner — no bids have been placed.');
      return;
    }

    const topBid = bids[0]; // highest discount bid = winner
    const bidderName = topBid?.customers?.full_name || 'Member';
    const groupValue = auction.chit_groups?.value || 0; // in paise
    const memberCount = auction.chit_groups?.capacity || 1;
    const discountPaise = topBid.bid_amount;               // what winner sacrifices
    const commissionPaise = Math.round(groupValue * 0.05); // 5% foreman commission
    const dividendPoolPaise = Math.max(discountPaise - commissionPaise, 0);
    const dividendPerMemberPaise = Math.round(dividendPoolPaise / memberCount);
    const installmentPaise = Math.round(groupValue / memberCount); // base EMI
    const finalDuePaise = Math.max(installmentPaise - dividendPerMemberPaise, 0);
    const prizePaise = Math.max(groupValue - discountPaise, 0);    // winner gets this

    Alert.alert(
      'Declare Winner & Settle',
      `Winner: ${bidderName}\nDiscount: ₹${(discountPaise / 100).toLocaleString()}\nPrize: ₹${(prizePaise / 100).toLocaleString()}\nDividend/Member: ₹${(dividendPerMemberPaise / 100).toLocaleString()}\nFinal EMI: ₹${(finalDuePaise / 100).toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Settle',
          onPress: async () => {
            setDeclaring(true);
            try {
              // Resolve winner_member_id from customer_id
              let winnerMemberId: string | null = null;
              if (topBid?.customer_id) {
                const { data: memberRow } = await supabase
                  .from('chit_members')
                  .select('id')
                  .eq('chit_group_id', auction.chit_group_id)
                  .eq('customer_id', topBid.customer_id)
                  .maybeSingle();
                winnerMemberId = memberRow?.id || null;
              }

              // Single update with ALL settlement fields
              const { error } = await supabase
                .from('auctions')
                .update({
                  status: 'completed',
                  winner_user_id: topBid.user_id || null,
                  winner_member_id: winnerMemberId,
                  winner_name: bidderName,
                  current_bid: discountPaise,
                  ended_at: new Date().toISOString(),
                  discount_amount: discountPaise,
                  installment_due: installmentPaise,
                  dividend_amount: dividendPerMemberPaise,
                  final_due_amount: finalDuePaise,
                  winner_prize_amount: prizePaise,
                })
                .eq('id', auction.id);

              if (error) throw error;

              // Directly update payment_schedules for every group member — no backend needed.
              // This is what the member app reads to show the correct installment amount.
              try {
                const { data: groupMembers } = await supabase
                  .from('chit_members')
                  .select('id, participation_share')
                  .eq('chit_group_id', auction.chit_group_id);

                if (groupMembers && groupMembers.length > 0 && auction.auction_number != null) {
                  const updatePromises = groupMembers.map((member: any) => {
                    const share = Number(member.participation_share || 1);
                    return supabase
                      .from('payment_schedules')
                      .update({
                        amount: Math.round(finalDuePaise * share),
                        dividend_amount: Math.round(dividendPerMemberPaise * share),
                      })
                      .eq('chit_member_id', member.id)
                      .eq('month_number', auction.auction_number);
                  });
                  await Promise.all(updatePromises);
                }
              } catch (scheduleErr) {
                console.warn('payment_schedules update (non-critical):', scheduleErr);
              }

              // Push notifications — non-critical, ignore if backend is offline
              try {
                await apiPost('/api/auctions/notify-installments', {
                  auctionId: auction.id,
                  message: `Installment for Auction #${auction.auction_number || ''} is due. Please pay now.`,
                });
              } catch (notifyErr) {
                console.warn('Push notification (non-critical):', notifyErr);
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', `${bidderName} declared as winner. Settlement saved and EMI updated to ₹${Math.round(finalDuePaise / 100).toLocaleString('en-IN')} for all members.`);
              router.push(`/(admin)/groups/${auction.chit_group_id}`);
            } catch (err: any) {
              console.error(err);
              Alert.alert('Error', err?.message || 'Failed to settle auction.');
            } finally {
              setDeclaring(false);
            }
          }
        }
      ]
    );
  };

  const handleCloseAuction = async () => {
    if (!auction) return;

    Alert.alert(
      'Stop Bidding',
      bids.length > 0
        ? `End the auction? Current highest bid is ₹${(bids[0].bid_amount / 100).toLocaleString('en-IN')} by ${bids[0].customers?.full_name || 'a member'}. You can finalise the settlement from the group page.`
        : 'No bids have been placed. Close this auction without a winner?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Auction',
          style: 'destructive',
          onPress: async () => {
            // Write the current highest bid into the auction row so the
            // settlement modal can auto-populate even without a formal Declare Winner
            const topBid = bids[0] || null;
            const groupValue = auction.chit_groups?.value || 0;
            const memberCount = auction.chit_groups?.capacity || 1;
            const discountPaise = topBid?.bid_amount ?? 0;
            const commissionPaise = Math.round(groupValue * 0.05);
            const dividendPoolPaise = Math.max(discountPaise - commissionPaise, 0);
            const dividendPerMemberPaise = Math.round(dividendPoolPaise / memberCount);
            const installmentPaise = Math.round(groupValue / memberCount);
            const finalDuePaise = Math.max(installmentPaise - dividendPerMemberPaise, 0);
            const prizePaise = Math.max(groupValue - discountPaise, 0);

            const { error } = await supabase
              .from('auctions')
              .update({
                status: 'completed',
                ended_at: new Date().toISOString(),
                // Pre-fill settlement fields from highest bid so settlement modal auto-populates
                ...(topBid ? {
                  current_bid: discountPaise,
                  discount_amount: discountPaise,
                  installment_due: installmentPaise,
                  dividend_amount: dividendPerMemberPaise,
                  final_due_amount: finalDuePaise,
                  winner_prize_amount: prizePaise,
                  // winner_member_id and winner_name left for admin to confirm in settlement modal
                } : {}),
              })
              .eq('id', auction.id);

            if (error) { Alert.alert('Error', error.message); return; }
            if (timerRef.current) clearInterval(timerRef.current);
            router.push(`/(admin)/groups/${auction.chit_group_id}`);
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#10D7CD" size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const topBid = bids[0]; // highest discount = winner
  const isLive = auction?.status === 'live';
  const groupValue = (auction?.chit_groups?.value || 0) / 100;
  const memberCount = auction?.chit_groups?.capacity || 1;
  const currentDiscount = topBid ? topBid.bid_amount / 100 : (auction?.current_bid || 0) / 100;

  // Live settlement economics
  const foremanCommission = groupValue * 0.05;
  const dividendPool = Math.max(0, currentDiscount - foremanCommission);
  const dividendPerMember = Math.floor(dividendPool / memberCount);
  const baseInstallment = Math.floor(groupValue / memberCount);
  const installmentDue = Math.max(0, baseInstallment - dividendPerMember);
  const winnerPrize = Math.max(0, groupValue - currentDiscount);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <AppLogo size={32} />
        <View style={styles.headerInfo}>
          <Text style={styles.groupName}>{auction?.chit_groups?.name || 'Live Auction'}</Text>
          <Text style={styles.groupCode}>{auction?.chit_groups?.group_code} • Auction #{auction?.auction_number}</Text>
        </View>
        <View style={styles.statusBox}>
          {isLive && <View style={styles.pulseIndicator} />}
          <Text style={styles.statusText}>{isLive ? 'LIVE' : 'UPCOMING'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Bidding Panel */}
        <View style={styles.biddingCard}>
          <View style={styles.timerRow}>
            <View style={styles.timerBadge}>
              <Text style={styles.timerLabel}>REMAINING TIME</Text>
              <Text style={styles.timerVal}>{timeLeft}</Text>
            </View>
            <View style={styles.bidCountBadge}>
              <Text style={styles.bidCountVal}>{bids.length}</Text>
              <Text style={styles.bidCountLabel}>BIDS</Text>
            </View>
          </View>

          <Text style={styles.lowestBidLabel}>CURRENT HIGHEST DISCOUNT OFFERED</Text>
          <Text style={styles.lowestBidVal}>₹{currentDiscount.toLocaleString('en-IN')}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Winner Gets</Text>
              <Text style={[styles.statVal, { color: '#54FAEF' }]}>₹{winnerPrize.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Dividend/Member</Text>
              <Text style={[styles.statVal, { color: '#10B981' }]}>₹{dividendPerMember.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {topBid && (
            <View style={styles.leaderBox}>
              <View style={styles.leaderAvatar}>
                <Text style={styles.leaderAvatarText}>{topBid.customers?.full_name?.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.leaderLabel}>CURRENT WINNER</Text>
                <Text style={styles.leaderName}>{topBid.customers?.full_name}</Text>
              </View>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#1</Text>
              </View>
            </View>
          )}
        </View>

        {/* Control Center */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Control Center</Text>
          <Text style={styles.sectionSub}>Manage the auction floor live.</Text>
        </View>

        {!isLive ? (
          <View style={{ padding: 20, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 12, marginHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#F59E0B', textAlign: 'center', fontSize: 16, fontWeight: '500' }}>
              This auction is UPCOMING, not LIVE.
            </Text>
            <Text style={{ color: '#F59E0B', textAlign: 'center', fontSize: 14, marginTop: 8, opacity: 0.8 }}>
              Go to the Chits tab, open this group, and click "START AUCTION" on the timeline to launch it.
            </Text>
          </View>
        ) : (
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.controlBtn, styles.btnSettle, bids.length === 0 && styles.btnDisabled]}
              onPress={handleDeclareWinner}
              disabled={bids.length === 0 || declaring}
            >
              {declaring ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>DECLARE WINNER</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, styles.btnStop]}
              onPress={handleCloseAuction}
            >
              <Text style={styles.btnText}>STOP BIDDING</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Live Bidding Feed */}
        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>Real-time Feed</Text>
          <View style={styles.feedBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.feedBadgeText}>UPDATED JUST NOW</Text>
          </View>
        </View>

        {bids.length === 0 ? (
          <View style={styles.emptyFeed}>
            <Text style={styles.emptyFeedText}>Awaiting first bid from members...</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {bids.map((bid, i) => (
              <View key={bid.id} style={[styles.feedItem, i === 0 && styles.feedItemTop]}>
                <View style={styles.feedTime}>
                  <Text style={styles.timeText}>{new Date(bid.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={styles.feedLineCol}>
                  <View style={[styles.feedDot, i === 0 && styles.feedDotActive]} />
                  {i < bids.length - 1 && <View style={styles.feedLine} />}
                </View>
                <View style={styles.feedContent}>
                  <Text style={styles.feedUser}>{bid.customers?.full_name}</Text>
                  <Text style={[styles.feedAmount, i === 0 && { color: '#10B981' }]}>
                    Discount Bid: ₹{(bid.bid_amount / 100).toLocaleString('en-IN')}
                  </Text>
                </View>
                {i === 0 && <View style={styles.winnerTag}><Text style={styles.winnerTagText}>WINNER</Text></View>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 70,
    backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155'
  },
  avatarContainer: {
    width: 32,
    height: 32,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 4 },
  headerInfo: { flex: 1 },
  groupName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FFFFFF' },
  groupCode: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8', marginTop: 2 },
  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100
  },
  pulseIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#EF4444', letterSpacing: 1 },

  scrollContent: { padding: 20, paddingBottom: 100 },
  biddingCard: {
    backgroundColor: '#1E293B', borderRadius: 28, padding: 24, marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10
  },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  timerBadge: { gap: 4 },
  timerLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.5 },
  timerVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#EF4444' },
  bidCountBadge: { alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  bidCountVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FFFFFF' },
  bidCountLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#94A3B8' },

  lowestBidLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748B', letterSpacing: 0.8, textAlign: 'center' },
  lowestBidVal: {
    fontFamily: 'SpaceGrotesk_700Bold', fontSize: 44, color: '#FFFFFF',
    textAlign: 'center', marginVertical: 12, letterSpacing: -1
  },

  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 24 },
  statItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 20, alignItems: 'center' },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', marginBottom: 4 },
  statVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FFFFFF' },

  leaderBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)'
  },
  leaderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  leaderAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#FFFFFF' },
  leaderLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#10B981', letterSpacing: 0.5 },
  leaderName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  rankBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rankText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFFFFF' },

  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FFFFFF' },
  sectionSub: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#64748B', marginTop: 4 },

  controlsRow: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  controlBtn: { flex: 1, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnSettle: { backgroundColor: '#005E7D' },
  btnStop: { backgroundColor: '#EF4444' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF', letterSpacing: 1 },

  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  feedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  feedBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#10B981' },

  emptyFeed: { alignItems: 'center', padding: 40, backgroundColor: '#1E293B', borderRadius: 20 },
  emptyFeedText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#64748B' },

  feedList: { paddingLeft: 12 },
  feedItem: { flexDirection: 'row', minHeight: 70 },
  feedItemTop: { minHeight: 90 },
  feedTime: { width: 60, paddingTop: 4 },
  timeText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' },
  feedLineCol: { width: 30, alignItems: 'center' },
  feedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#334155', zIndex: 2, borderWidth: 2, borderColor: '#0F172A' },
  feedDotActive: { backgroundColor: '#10B981', transform: [{ scale: 1.4 }] },
  feedLine: { width: 2, flex: 1, backgroundColor: '#1E293B', marginTop: -4, marginBottom: -4, zIndex: 1 },
  feedContent: { flex: 1, paddingLeft: 12, paddingBottom: 24 },
  feedUser: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  feedAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#64748B', marginTop: 2 },
  winnerTag: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, height: 24 },
  winnerTagText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#FFFFFF' },
});
