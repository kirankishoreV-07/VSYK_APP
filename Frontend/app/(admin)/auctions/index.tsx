import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../../components/AppLogo';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import {
  dedupeAuctionRows,
  filterScheduledUpcomingForTab,
  sanitizePlaceholderAuctionSchedules,
} from '../../../lib/auctionUtils';
import { getAuctionWinnerDisplayName } from '../../../lib/auctionWinner';

// ─── Types ────────────────────────────────────────────────────
type AuctionRow = {
  id: string;
  chit_group_id: string;
  auction_number: number | null;
  status: string;
  scheduled_at: string | null;
  closes_at: string | null;
  ended_at: string | null;
  current_bid: number;
  min_bid: number;
  max_bid: number | null;
  discount_amount: number;
  dividend_amount: number;
  final_due_amount: number;
  winner_prize_amount: number;
  winner_name: string | null;
  winner_member_id: string | null;
  chit_groups: { name: string; group_code: string; value: number; capacity: number } | null;
  _bid_count?: number;
  _winner_display?: string;
};

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtRupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const statusColor = (s: string) =>
  s === 'live' ? '#10B981' : s === 'completed' ? '#005E7D' : s === 'cancelled' ? '#EF4444' : '#F59E0B';
const statusBg = (s: string) =>
  s === 'live' ? '#D1FAE5' : s === 'completed' ? '#E0F2FE' : s === 'cancelled' ? '#FEE2E2' : '#FEF3C7';

export default function AdminAuctionsIndex() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'history' | 'upcoming'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [allAuctions, setAllAuctions] = useState<AuctionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*, chit_groups(name, group_code, value, capacity)')
        .order('scheduled_at', { ascending: false });
      if (error) throw error;

      let rows = (data || []) as AuctionRow[];
      const sanitized = await sanitizePlaceholderAuctionSchedules(supabase, rows);
      if (sanitized) {
        const { data: refreshed, error: refreshError } = await supabase
          .from('auctions')
          .select('*, chit_groups(name, group_code, value, capacity)')
          .order('scheduled_at', { ascending: false });
        if (refreshError) throw refreshError;
        rows = (refreshed || []) as AuctionRow[];
      }
      rows = dedupeAuctionRows(rows);

      const ids = rows.map(r => r.id);
      if (ids.length > 0) {
        const { data: bidCounts } = await supabase
          .from('auction_bids')
          .select('auction_id')
          .in('auction_id', ids)
          .eq('is_retracted', false);
        const countMap: Record<string, number> = {};
        for (const b of (bidCounts || [])) countMap[b.auction_id] = (countMap[b.auction_id] || 0) + 1;
        rows.forEach(r => { r._bid_count = countMap[r.id] || 0; });
      }

      const winnerMemberIds = [
        ...new Set(
          rows
            .map((r) => r.winner_member_id)
            .filter((id): id is string => !!id),
        ),
      ];
      if (winnerMemberIds.length > 0) {
        const { data: winnerMembers } = await supabase
          .from('chit_members')
          .select('id, ticket_number, customers(full_name)')
          .in('id', winnerMemberIds);
        const memberRefs = (winnerMembers || []).map((m: any) => ({
          id: m.id,
          ticket_number: m.ticket_number,
          customers: Array.isArray(m.customers) ? m.customers[0] : m.customers,
        }));
        rows.forEach((r) => {
          r._winner_display = getAuctionWinnerDisplayName(r, memberRefs);
        });
      } else {
        rows.forEach((r) => {
          r._winner_display = getAuctionWinnerDisplayName(r, []);
        });
      }

      setAllAuctions(rows);
    } catch (err) {
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    // Debounced refetch shared by both realtime tables (coalesces bursts of bids).
    const scheduleRefetch = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(fetchAll, 400);
    };
    const ch = supabase.channel('admin-auctions-rt')
      // Auction status / settlement changes (live banner, history, winner).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, scheduleRefetch)
      // Bids drive the per-row bid counts shown on this dashboard — without this
      // subscription the counts only changed on auction status updates, never on
      // new bids. (Requires migration 031 to publish auction_bids to realtime.)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_bids' }, scheduleRefetch)
      .subscribe();

    // Safety-net poll: if realtime drops (app backgrounded, network change),
    // the dashboard still converges within 15s instead of needing a manual refresh.
    const poll = setInterval(fetchAll, 15000);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, []);

  const live = allAuctions.find(a => a.status === 'live');
  const scheduledUpcoming = filterScheduledUpcomingForTab(allAuctions);
  const history = allAuctions.filter(a => a.status === 'completed' || a.status === 'cancelled');

  // Summary stats
  const totalSettled = history.filter(a => a.status === 'completed').length;
  const totalPrizePaid = history.reduce((s, a) => s + (a.winner_prize_amount || 0), 0);
  const totalDividend = history.reduce((s, a) => s + (a.dividend_amount || 0), 0);
  const avgDiscount = totalSettled > 0
    ? history.filter(a => a.status === 'completed').reduce((s, a) => s + (a.discount_amount || 0), 0) / totalSettled
    : 0;

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      {/* App Bar */}
      <View style={st.appBar}>
        <View style={st.appBarLeft}>
          <AppLogo size={36} />
          <Text style={st.appBarTitle}>Auctions</Text>
        </View>
        <TouchableOpacity
          style={[st.liveBtn, !live && st.liveBtnOff]}
          onPress={() => { Haptics.selectionAsync(); router.push(live ? { pathname: '/(admin)/auctions/live', params: { auctionId: live.id } } : '/(admin)/auctions/live'); }}
        >
          <View style={[st.liveDot, { backgroundColor: live ? '#FFFFFF' : '#94A3B8' }]} />
          <Text style={[st.liveBtnText, !live && { color: '#64748B' }]}>{live ? 'LIVE NOW' : 'No Live'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={st.tabs}>
        {(['upcoming', 'history'] as const).map(t => (
          <TouchableOpacity key={t} style={[st.tab, activeTab === t && st.tabActive]} onPress={() => { setActiveTab(t); Haptics.selectionAsync(); }}>
            <Text style={[st.tabText, activeTab === t && st.tabTextActive]}>
              {t === 'upcoming' ? `Upcoming  ${scheduledUpcoming.length > 0 ? `(${scheduledUpcoming.length})` : ''}` : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#005E7D" />}>

        {loading ? (
          <ActivityIndicator color="#005E7D" size="large" style={{ marginTop: 60 }} />
        ) : activeTab === 'upcoming' ? (
          <UpcomingTab live={live} upcoming={scheduledUpcoming} router={router} />
        ) : (
          <HistoryTab history={history} stats={{ totalSettled, totalPrizePaid, totalDividend, avgDiscount }} />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Upcoming Tab ─────────────────────────────────────────────
function UpcomingTab({ live, upcoming, router }: { live: AuctionRow | undefined; upcoming: AuctionRow[]; router: any }) {
  return (
    <View>
      {/* Live banner */}
      {live && (
        <TouchableOpacity style={st.liveBanner} onPress={() => router.push({ pathname: '/(admin)/auctions/live', params: { auctionId: live.id } })} activeOpacity={0.85}>
          <View style={st.livePulse} />
          <View style={{ flex: 1 }}>
            <Text style={st.liveBannerTitle}>AUCTION IN PROGRESS</Text>
            <Text style={st.liveBannerSub}>
              {live.chit_groups?.name} · Auction #{live.auction_number} · {live._bid_count || 0} bids so far
            </Text>
          </View>
          <View style={st.liveBannerArrow}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </Svg>
          </View>
        </TouchableOpacity>
      )}

      {!live && (
        <View style={st.noLiveCard}>
          <Text style={st.noLiveTitle}>No auction is currently live</Text>
          <Text style={st.noLiveSub}>Go to a Chit Group and tap "START AUCTION" on the roadmap to launch one.</Text>
        </View>
      )}

      {upcoming.length > 0 && (
        <>
          <Text style={st.sectionTitle}>Scheduled Auctions</Text>
          {upcoming.map(a => (
              <View key={a.id} style={st.upcomingCard}>
                <View style={st.upcomingHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.upcomingGroup}>{a.chit_groups?.name}</Text>
                    <Text style={st.upcomingCode}>{a.chit_groups?.group_code} · Auction #{a.auction_number}</Text>
                  </View>
                  <View style={[st.statusPill, { backgroundColor: statusBg('upcoming') }]}>
                    <Text style={[st.statusPillText, { color: statusColor('upcoming') }]}>SCHEDULED</Text>
                  </View>
                </View>

                <View style={st.upcomingGrid}>
                  <View style={st.upcomingCell}>
                    <Text style={st.cellLabel}>STARTS</Text>
                    <Text style={st.cellVal}>{fmt(a.scheduled_at)}</Text>
                  </View>
                  <View style={st.upcomingCell}>
                    <Text style={st.cellLabel}>CLOSES</Text>
                    <Text style={st.cellVal}>{fmt(a.closes_at)}</Text>
                  </View>
                  <View style={st.upcomingCell}>
                    <Text style={st.cellLabel}>CHIT VALUE</Text>
                    <Text style={st.cellVal}>{fmtRupees(a.chit_groups?.value || 0)}</Text>
                  </View>
                  <View style={st.upcomingCell}>
                    <Text style={st.cellLabel}>BID RANGE</Text>
                    <Text style={st.cellVal}>{fmtRupees(a.min_bid)} – {a.max_bid ? fmtRupees(a.max_bid) : 'No max'}</Text>
                  </View>
                </View>
              </View>
            ))}
        </>
      )}

      {!live && upcoming.length === 0 && (
        <View style={st.emptyCard}>
          <Text style={st.emptyText}>No upcoming auctions configured yet.</Text>
        </View>
      )}
    </View>
  );
}

// ─── History Tab ──────────────────────────────────────────────
function HistoryTab({ history, stats }: {
  history: AuctionRow[];
  stats: { totalSettled: number; totalPrizePaid: number; totalDividend: number; avgDiscount: number };
}) {
  if (history.length === 0) {
    return (
      <View style={st.emptyCard}>
        <Text style={st.emptyText}>No completed auctions yet. History will appear here once an auction is settled.</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Summary stats row */}
      <View style={st.statsRow}>
        <View style={[st.statCard, { flex: 1 }]}>
          <Text style={st.statLabel}>SETTLED</Text>
          <Text style={st.statVal}>{stats.totalSettled}</Text>
        </View>
        <View style={[st.statCard, { flex: 1 }]}>
          <Text style={st.statLabel}>PRIZE PAID</Text>
          <Text style={[st.statVal, { color: '#005E7D' }]}>{fmtRupees(stats.totalPrizePaid)}</Text>
        </View>
        <View style={[st.statCard, { flex: 1 }]}>
          <Text style={st.statLabel}>DIVIDENDS</Text>
          <Text style={[st.statVal, { color: '#10B981' }]}>{fmtRupees(stats.totalDividend)}</Text>
        </View>
      </View>

      <View style={[st.statCard, { marginBottom: 20 }]}>
        <Text style={st.statLabel}>AVG DISCOUNT PER AUCTION</Text>
        <Text style={[st.statVal, { color: '#F59E0B' }]}>{fmtRupees(stats.avgDiscount)}</Text>
      </View>

      <Text style={st.sectionTitle}>Auction History</Text>
      {history.map((a, i) => {
        const sc = statusColor(a.status);
        const sb = statusBg(a.status);
        const settled = a.status === 'completed';
        return (
          <View key={a.id} style={st.historyCard}>
            {/* Header */}
            <View style={st.historyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={st.historyGroup}>{a.chit_groups?.name}</Text>
                <Text style={st.historyCode}>{a.chit_groups?.group_code} · Auction #{a.auction_number}</Text>
              </View>
              <View style={[st.statusPill, { backgroundColor: sb }]}>
                <Text style={[st.statusPillText, { color: sc }]}>{a.status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Date row */}
            <View style={st.historyDateRow}>
              <Text style={st.historyDateLabel}>Held on</Text>
              <Text style={st.historyDateVal}>{fmtDate(a.ended_at || a.scheduled_at)}</Text>
            </View>

            {settled && (
              <>
                {/* Winner bar */}
                <View style={st.winnerBar}>
                  <View style={st.winnerAvatar}>
                    <Text style={st.winnerAvatarText}>
                      {(a._winner_display || a.winner_name || 'W').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.winnerLabel}>WINNER</Text>
                    <Text style={st.winnerName}>{a._winner_display || getAuctionWinnerDisplayName(a, [])}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.winnerLabel}>PRIZE</Text>
                    <Text style={st.winnerPrize}>{fmtRupees(a.winner_prize_amount)}</Text>
                  </View>
                </View>

                {/* Settlement grid */}
                <View style={st.settlementGrid}>
                  <View style={st.settlementCell}>
                    <Text style={st.cellLabel}>DISCOUNT</Text>
                    <Text style={st.cellValGreen}>{fmtRupees(a.discount_amount)}</Text>
                  </View>
                  <View style={st.settlementCell}>
                    <Text style={st.cellLabel}>DIVIDEND/MEMBER</Text>
                    <Text style={st.cellValGreen}>{fmtRupees(a.dividend_amount)}</Text>
                  </View>
                  <View style={st.settlementCell}>
                    <Text style={st.cellLabel}>PAYABLE EMI</Text>
                    <Text style={[st.cellVal, { color: '#005E7D' }]}>{fmtRupees(a.final_due_amount)}</Text>
                  </View>
                  <View style={st.settlementCell}>
                    <Text style={st.cellLabel}>TOTAL BIDS</Text>
                    <Text style={st.cellVal}>{a._bid_count || 0}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 64, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarContainer: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: '100%', height: '100%' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#0F172A', letterSpacing: -0.5 },
  liveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100 },
  liveBtnOff: { backgroundColor: '#F1F5F9' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFFFFF', letterSpacing: 0.5 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab: { paddingVertical: 14, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#005E7D' },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },
  tabTextActive: { color: '#005E7D' },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#0F172A', marginBottom: 14, marginTop: 4 },

  // Live banner
  liveBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', borderRadius: 18, padding: 18, marginBottom: 20, gap: 12 },
  livePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  liveBannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFFFFF', letterSpacing: 1, marginBottom: 4 },
  liveBannerSub: { fontFamily: 'Inter_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  liveBannerArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  noLiveCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  noLiveTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B', marginBottom: 6 },
  noLiveSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  // Upcoming card
  upcomingCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  upcomingHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  upcomingGroup: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#0B1C30' },
  upcomingCode: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  upcomingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  upcomingCell: { minWidth: '45%' },

  // Status pill
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, marginBottom: 4 },
  statVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },

  // History card
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  historyGroup: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#0B1C30' },
  historyCode: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  historyDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  historyDateLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8' },
  historyDateVal: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#0B1C30' },

  // Winner bar
  winnerBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  winnerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  winnerAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#FFFFFF' },
  winnerLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#64748B', letterSpacing: 0.5 },
  winnerName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0B1C30' },
  winnerPrize: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#005E7D' },

  // Settlement grid
  settlementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  settlementCell: { minWidth: '45%', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 },

  // Shared cell styles
  cellLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, marginBottom: 3 },
  cellVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#0B1C30' },
  cellValGreen: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#10B981' },

  emptyCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
});
