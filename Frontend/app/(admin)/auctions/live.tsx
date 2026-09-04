
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../../components/AppLogo';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { apiPostAdmin } from '../../../lib/api';
import { isAuctionConfiguredUpcoming } from '../../../lib/auctionUtils';

export default function AdminLiveAuction() {
  const router = useRouter();
  // The auction the caller navigated from. Without it this screen used to
  // search the whole database for *any* live auction and fall back to *any*
  // configured upcoming one, so it could display a different group's
  // auto-generated placeholder than the auction the admin actually opened.
  const { auctionId: routeAuctionId } = useLocalSearchParams<{ auctionId?: string }>();
  const requestedAuctionId = typeof routeAuctionId === 'string' && routeAuctionId ? routeAuctionId : null;
  const [auction, setAuction] = useState<any | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);
  const [timeLeft, setTimeLeft] = useState('--:--');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const auctionIdRef = useRef<string | null>(null);

  // A realtime channel can drop with a transient close (code 1001 "Stream end
  // encountered" when the app is backgrounded or the network flaps). Supabase
  // auto-reconnects and our 10s poll bridges any gap, so these are NOT real
  // errors — log them quietly instead of as console.error noise.
  const isTransientRealtimeError = (err: any) => {
    const msg = String(err?.message || err || '');
    return /socket closed|stream end|1001|1006|timed out|CHANNEL_ERROR/i.test(msg);
  };

  const fetchBids = useCallback(async (auctionId: string) => {
    try {
      // Highest discount bid wins — sort descending, exclude retracted bids
      const { data } = await supabase
        .from('auction_bids')
        .select('*, customers(full_name)')
        .eq('auction_id', auctionId)
        .eq('is_retracted', false)
        .order('bid_amount', { ascending: false });

      if (!data) { setBids([]); setFeed([]); return; }

      // Full chronological history of EVERY bid placed in this auction (newest first).
      // This is what the admin sees in the "Bidding History" feed so they can review
      // the entire timeline of the group's bidding — not just one row per member.
      const byTime = [...data].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
      setFeed(byTime);

      // Per member: keep only their most recent active bid (latest placed_at).
      // A member's latest bid IS their current standing — earlier bids are superseded.
      // This drives the leaderboard + current-winner card.
      const latestPerMember = new Map<string, any>();
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
  }, []);

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

  const fetchLiveAuction = useCallback(async () => {
    try {
      // Explicit target wins: load exactly the auction that was opened, whatever
      // its status, so this screen can never disagree with the screen that
      // linked here.
      if (requestedAuctionId) {
        const { data: requested, error: requestedError } = await supabase
          .from('auctions')
          .select('*, chit_groups(name, group_code, value, capacity, monthly_installment, agent_commission_rate)')
          .eq('id', requestedAuctionId)
          .maybeSingle();
        if (requestedError) throw requestedError;
        if (requested?.id) {
          auctionIdRef.current = requested.id;
          setAuction(requested);
          fetchBids(requested.id);
          startTimer(requested.closes_at, requested.scheduled_at);
          return;
        }
      }

      const { data: liveAuction, error: liveError } = await supabase
        .from('auctions')
        .select('*, chit_groups(name, group_code, value, capacity, monthly_installment, agent_commission_rate)')
        .eq('status', 'live')
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();

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
        .select('*, chit_groups(name, group_code, value, capacity, monthly_installment, agent_commission_rate)')
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
  }, [fetchBids, requestedAuctionId]);

  // Derived values used by handlers (hoisted for fresh closures in event handlers)
  const topBid = bids[0];
  const isLive = auction?.status === 'live';

  // Robust realtime setup for the *current* auction.
  // Previous implementation used a single hardcoded global channel ('live_bids') set up once
  // with no filter. This caused missed INSERT events from the member side until a full
  // logout/login (fresh client + fresh subscription after the auction was active).
  // Fix: 
  // - Dynamic channel name per auction
  // - postgres_changes *filter* on the specific auction_id (server-side efficient + reliable delivery)
  // - Effect depends on the current auction id so we (re)subscribe when the live/upcoming auction changes
  // - Proper subscribe status logging
  // - Listen to INSERT + UPDATE (retracts can affect leaderboard)
  // - Initial fetchBids when we have an id
  useEffect(() => {
    const auctionId = auction?.id || auctionIdRef.current;
    if (!auctionId) return;

    // Update ref for any legacy paths
    auctionIdRef.current = auctionId;

    // Unique channel per auction prevents conflicts across devices/sessions/other auctions
    const bidsChannel = supabase
      .channel(`admin-live-bids-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT for new bids, UPDATE for retracts etc.
          schema: 'public',
          table: 'auction_bids',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          // Always refetch the authoritative leaderboard for this auction
          fetchBids(auctionId);

          // Haptic only for new bids on *this* auction
          if (payload.eventType === 'INSERT') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Good — events for this auction will now flow reliably
          console.log(`[admin live] bids realtime SUBSCRIBED for auction ${auctionId}`);
        }
        // On a transient drop, refetch once so we don't miss bids during the gap.
        // The client auto-reconnects; the poll is the longer-term safety net.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          fetchBids(auctionId);
        }
        if (err && !isTransientRealtimeError(err)) {
          console.error('[admin live] bids realtime subscription error:', err);
        }
      });

    // Also listen specifically to *this* auction's status updates (more efficient than global)
    const auctionChannel = supabase
      .channel(`admin-live-auction-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`,
        },
        () => {
          fetchLiveAuction();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[admin live] auction status SUBSCRIBED for ${auctionId}`);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          fetchLiveAuction();
        }
        if (err && !isTransientRealtimeError(err)) {
          console.error('[admin live] auction status realtime error:', err);
        }
      });

    // Ensure we have the latest bids right when this subscription activates
    fetchBids(auctionId);

    // Safety-net poll for the live control center. Realtime is the primary path
    // (instant), but on mobile a subscription can silently drop when the app is
    // backgrounded or the network flaps. A 10s poll guarantees the leaderboard
    // and bid count still converge without a logout/refresh. Cheap: one filtered
    // query against a small per-auction bid set.
    const poll = setInterval(() => {
      fetchBids(auctionId);
      fetchLiveAuction();
    }, 10000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(auctionChannel);
    };
  }, [auction?.id, fetchBids, fetchLiveAuction]); // Re-run (cleanup old + subscribe new) when the auction we are watching changes. Stable callbacks won't cause spurious re-subs.

  // Initial fetch on mount. The id-dependent effect (below) handles (re)subscriptions + live bid updates.
  useEffect(() => {
    fetchLiveAuction();
  }, [fetchLiveAuction]);

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
    const commissionRate = Math.min(Math.max(Number(auction.chit_groups?.agent_commission_rate ?? 5), 0), 100) / 100;
    const commissionPaise = Math.round(groupValue * commissionRate);
    const dividendPoolPaise = Math.max(discountPaise - commissionPaise, 0);
    const dividendPerMemberPaise = Math.round(dividendPoolPaise / memberCount);
    const installmentPaise = Number(auction.chit_groups?.monthly_installment || 0) || Math.round(groupValue / memberCount);
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

              const settlement = await apiPostAdmin<{ ok: boolean; updated: number }>(
                '/api/auctions/apply-settlement',
                {
                  auctionId: auction.id,
                  winnerMemberId,
                  winnerName: bidderName,
                  currentBid: discountPaise,
                  installmentDue: installmentPaise,
                  dividendAmount: dividendPerMemberPaise,
                  discountAmount: discountPaise,
                  finalDueAmount: finalDuePaise,
                  winnerPrizeAmount: prizePaise,
                },
              );
              const scheduleSummary = ` Dues updated for ${settlement.updated} member${settlement.updated === 1 ? '' : 's'}.`;

              // Push notifications — non-critical
              try {
                await apiPostAdmin('/api/auctions/notify-installments', {
                  auctionId: auction.id,
                  message: `Installment for Auction #${auction.auction_number || ''} is due. Please pay now.`,
                });
              } catch (notifyErr) {
                console.warn('Push notification (non-critical):', notifyErr);
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Success',
                `${bidderName} declared as winner.${scheduleSummary} EMI set to ₹${Math.round(finalDuePaise / 100).toLocaleString('en-IN')} for the cycle.`,
              );
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

  const handleSafeBack = () => {
    if (isLive && bids.length > 0) {
      Alert.alert(
        'Auction Still Live',
        'There are active bids. Use DECLARE WINNER or STOP BIDDING to properly close the auction and update member payment dues.',
        [
          { text: 'Stay Here', style: 'cancel' },
          { text: 'Stop Bidding Now', style: 'destructive', onPress: handleCloseAuction },
        ],
      );
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace('/(admin)/auctions');
  };

  const handleCloseAuction = async () => {
    if (!auction) return;

    Alert.alert(
      'Stop Bidding',
      bids.length > 0
        ? `End the auction? Current highest bid is ₹${(bids[0].bid_amount / 100).toLocaleString('en-IN')} by ${bids[0].customers?.full_name || 'a member'}. Dues will be updated for all members immediately.`
        : 'No bids have been placed. Close this auction without a winner? Base installment will apply for the cycle.',
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
            const commissionRate = Math.min(Math.max(Number(auction.chit_groups?.agent_commission_rate ?? 5), 0), 100) / 100;
            const commissionPaise = Math.round(groupValue * commissionRate);
            const dividendPoolPaise = Math.max(discountPaise - commissionPaise, 0);
            const dividendPerMemberPaise = Math.round(dividendPoolPaise / memberCount);
            const installmentPaise = Number(auction.chit_groups?.monthly_installment || 0) || Math.round(groupValue / memberCount);
            const finalDuePaise = Math.max(installmentPaise - dividendPerMemberPaise, 0);
            const prizePaise = Math.max(groupValue - discountPaise, 0);

            try {
              let winnerMemberId: string | null = null;
              if (topBid?.customer_id) {
                const { data: memberRow, error: memberError } = await supabase
                  .from('chit_members')
                  .select('id')
                  .eq('chit_group_id', auction.chit_group_id)
                  .eq('customer_id', topBid.customer_id)
                  .maybeSingle();
                if (memberError) throw memberError;
                winnerMemberId = memberRow?.id || null;
              }

              await apiPostAdmin('/api/auctions/apply-settlement', {
                auctionId: auction.id,
                winnerMemberId,
                winnerName: topBid?.customers?.full_name || null,
                currentBid: discountPaise,
                installmentDue: installmentPaise,
                dividendAmount: dividendPerMemberPaise,
                discountAmount: discountPaise,
                finalDueAmount: finalDuePaise,
                winnerPrizeAmount: topBid ? prizePaise : 0,
              });
            } catch (error: any) {
              Alert.alert('Could Not Close Auction', error?.message || 'Settlement failed. No financial changes were saved.');
              return;
            }

            if (timerRef.current) clearInterval(timerRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              'Auction Closed',
              topBid
                ? `Bidding stopped. Winner and dues for cycle #${auction.auction_number} were saved together (₹${Math.round(finalDuePaise / 100).toLocaleString('en-IN')} payable).`
                : 'Auction closed (no bids).',
            );
            router.push(`/(admin)/groups/${auction.chit_group_id}`);
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#005E7D" size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // topBid / isLive hoisted earlier for handler closures. Recompute fresh derived values here for render.
  const groupValue = (auction?.chit_groups?.value || 0) / 100;
  const memberCount = auction?.chit_groups?.capacity || 1;
  const currentDiscount = topBid ? topBid.bid_amount / 100 : (auction?.current_bid || 0) / 100;

  // Live settlement economics
  const commissionRate = Math.min(Math.max(Number(auction?.chit_groups?.agent_commission_rate ?? 5), 0), 100) / 100;
  const foremanCommission = groupValue * commissionRate;
  const dividendPool = Math.max(0, currentDiscount - foremanCommission);
  const dividendPerMember = Math.floor(dividendPool / memberCount);
  const baseInstallment = Math.floor(groupValue / memberCount);
  const installmentDue = Math.max(0, baseInstallment - dividendPerMember);
  const winnerPrize = Math.max(0, groupValue - currentDiscount);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleSafeBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to auctions"
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="#0B1C30">
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
              <Text style={[styles.statVal, { color: '#005E7D' }]}>₹{winnerPrize.toLocaleString('en-IN')}</Text>
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

        {/* Full Bidding History */}
        <View style={styles.feedHeader}>
          <View>
            <Text style={styles.sectionTitle}>Bidding History</Text>
            <Text style={styles.sectionSub}>Every bid placed in this auction.</Text>
          </View>
          <View style={styles.feedBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.feedBadgeText}>{feed.length} {feed.length === 1 ? 'BID' : 'BIDS'}</Text>
          </View>
        </View>

        {feed.length === 0 ? (
          <View style={styles.emptyFeed}>
            <Text style={styles.emptyFeedText}>Awaiting first bid from members...</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {feed.map((bid, i) => {
              // Highlight the row that is the current standing winner (highest active bid).
              const isWinning = topBid && bid.id === topBid.id;
              return (
                <View key={bid.id} style={[styles.feedItem, i === feed.length - 1 && styles.feedItemLast]}>
                  <View style={styles.feedTime}>
                    <Text style={styles.timeText}>{new Date(bid.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={styles.feedLineCol}>
                    <View style={[styles.feedDot, isWinning && styles.feedDotActive]} />
                    {i < feed.length - 1 && <View style={styles.feedLine} />}
                  </View>
                  <View style={styles.feedContent}>
                    <View style={styles.feedRowTop}>
                      <Text style={styles.feedUser}>{bid.customers?.full_name || 'Member'}</Text>
                      {isWinning && <View style={styles.winnerTag}><Text style={styles.winnerTagText}>LEADING</Text></View>}
                    </View>
                    <Text style={[styles.feedAmount, isWinning && { color: '#10B981' }]}>
                      Discount Bid: ₹{(bid.bid_amount / 100).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, height: 70,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
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
  groupName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  groupCode: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100
  },
  pulseIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#EF4444', letterSpacing: 1 },

  scrollContent: { padding: 20, paddingBottom: 100 },
  biddingCard: {
    backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, marginBottom: 32,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#0B1C30', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4
  },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  timerBadge: { gap: 4 },
  timerLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.5 },
  timerVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#EF4444' },
  bidCountBadge: { alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  bidCountVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#0B1C30' },
  bidCountLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#94A3B8' },

  lowestBidLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.8, textAlign: 'center' },
  lowestBidVal: {
    fontFamily: 'SpaceGrotesk_700Bold', fontSize: 44, color: '#005E7D',
    textAlign: 'center', marginVertical: 12, letterSpacing: -1
  },

  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 24 },
  statItem: { flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', marginBottom: 4 },
  statVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },

  leaderBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4', padding: 16, borderRadius: 20,
    borderWidth: 1, borderColor: '#BBF7D0'
  },
  leaderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  leaderAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#FFFFFF' },
  leaderLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#10B981', letterSpacing: 0.5 },
  leaderName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0B1C30' },
  rankBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rankText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFFFFF' },

  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#0B1C30' },
  sectionSub: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#64748B', marginTop: 4 },

  controlsRow: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  controlBtn: { flex: 1, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnSettle: { backgroundColor: '#005E7D' },
  btnStop: { backgroundColor: '#EF4444' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF', letterSpacing: 1 },

  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  feedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  feedBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#10B981' },

  emptyFeed: { alignItems: 'center', padding: 40, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyFeedText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#94A3B8' },

  feedList: { paddingLeft: 4 },
  feedItem: { flexDirection: 'row', minHeight: 64 },
  feedItemLast: { minHeight: 48 },
  feedTime: { width: 56, paddingTop: 2 },
  timeText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8' },
  feedLineCol: { width: 24, alignItems: 'center' },
  feedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#CBD5E1', zIndex: 2, borderWidth: 2, borderColor: '#F8F9FF' },
  feedDotActive: { backgroundColor: '#10B981', transform: [{ scale: 1.4 }] },
  feedLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: -2, marginBottom: -2, zIndex: 1 },
  feedContent: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  feedRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedUser: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  feedAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#64748B', marginTop: 2 },
  winnerTag: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  winnerTagText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#FFFFFF', letterSpacing: 0.5 },
});
