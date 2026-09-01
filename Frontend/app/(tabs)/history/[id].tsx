import { useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../../lib/constants';
import { formatPaise } from '../../../lib/hooks/useDashboard';
import { useMemberSession } from '../../../lib/MemberSessionContext';
import { supabase } from '../../../lib/supabase';
import {
  buildGroupHistoryExport,
  buildGroupHistoryFilename,
  fetchGroupHistoryDetail,
  getStatusColor,
  getStatusLabel,
  UNAUTHORED_THEME,
  type GroupHistoryDetail,
} from '../../../lib/memberGroupHistory';
import { WINNER_HIGHLIGHT } from '../../../lib/auctionWinner';
import { shareCsvFile } from '../../../lib/csvExport';

const CHART_COLORS = {
  paid: '#10B981',
  partial: '#F59E0B',
  pending: '#EF4444',
  awaiting: '#94A3B8',
};

function DonutChart({ detail }: { detail: GroupHistoryDetail }) {
  const segments = [
    { key: 'paid', value: detail.breakdown.paidAmount, color: CHART_COLORS.paid, label: 'Paid' },
    { key: 'partial', value: detail.breakdown.partialAmount, color: CHART_COLORS.partial, label: 'Partial' },
    { key: 'pending', value: detail.breakdown.pendingAmount, color: CHART_COLORS.pending, label: 'Pending' },
    { key: 'awaiting', value: detail.breakdown.awaitingAmount, color: CHART_COLORS.awaiting, label: 'Awaiting' },
  ].filter((s) => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 52;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={st.chartCard}>
      <Text style={st.sectionTitle}>Payment Breakdown</Text>
      <View style={st.chartRow}>
        <View style={st.donutWrap}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            <Circle cx={70} cy={70} r={radius} stroke="#F1F5F9" strokeWidth={stroke} fill="none" />
            {segments.map((seg) => {
              const dash = (seg.value / total) * circumference;
              const circle = (
                <Circle
                  key={seg.key}
                  cx={70}
                  cy={70}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  rotation={-90}
                  origin="70, 70"
                />
              );
              offset += dash;
              return circle;
            })}
          </Svg>
          <View style={st.donutCenter}>
            <Text style={st.donutCenterLabel}>TOTAL PAID</Text>
            <Text style={st.donutCenterVal}>{formatPaise(detail.summary.totalPaid)}</Text>
          </View>
        </View>

        <View style={st.legend}>
          {segments.map((seg) => (
            <View key={seg.key} style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: seg.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.legendLabel}>{seg.label}</Text>
                <Text style={st.legendVal}>{formatPaise(seg.value)}</Text>
              </View>
              <Text style={st.legendPct}>{Math.round((seg.value / total) * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function MonthBarChart({ detail }: { detail: GroupHistoryDetail }) {
  const maxPaid = Math.max(...detail.months.map((m) => m.paidAmount), 1);

  return (
    <View style={st.chartCard}>
      <Text style={st.sectionTitle}>Month-wise Collections</Text>
      <View style={st.barChart}>
        {detail.months.map((m) => {
          const h = Math.max(6, (m.paidAmount / maxPaid) * 72);
          const color = getStatusColor(m.status);
          return (
            <View key={m.monthNumber} style={st.barCol}>
              <View style={[st.bar, { height: h, backgroundColor: color }]} />
              <Text style={st.barLabel}>M{m.monthNumber}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function GroupHistoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { memberId } = useMemberSession();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['group-history', id, memberId],
    queryFn: () => fetchGroupHistoryDetail(id!, memberId!),
    enabled: !!id && !!memberId,
  });

  useEffect(() => {
    if (!id || !memberId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['group-history', id, memberId] });
      queryClient.invalidateQueries({ queryKey: ['member-group-history', memberId] });
    };

    const channel = supabase
      .channel(`group-history-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_member_transactions', filter: `chit_member_id=eq.${id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_collections', filter: `chit_member_id=eq.${id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedules', filter: `chit_member_id=eq.${id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, invalidate)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, memberId, queryClient]);

  const handleExport = async () => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await shareCsvFile({
        filename: buildGroupHistoryFilename(data.summary.groupName),
        content: buildGroupHistoryExport(data),
        dialogTitle: `${data.summary.groupName} — Payment History`,
      });
    } catch {
      Alert.alert('Export failed', 'Could not export payment history file. Please try again.');
    }
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView style={st.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const { summary } = data;
  const isUnaccounted = summary.accountingType === 'unaccounted';

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <Text style={st.appBarTitle} numberOfLines={1}>{summary.groupName}</Text>
        <TouchableOpacity onPress={handleExport} style={st.exportBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={[st.summaryCard, isUnaccounted && st.summaryCardUnaccounted]}>
          <View style={st.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={st.summaryName}>{summary.groupName}</Text>
              <Text style={st.summaryMeta}>
                {isUnaccounted ? 'Cash Only Group' : 'Accounted Group'}
                {' · '}{summary.isCompleted ? 'Completed' : 'Active'}
              </Text>
            </View>
            <View style={[st.statusBadge, { backgroundColor: summary.isCompleted ? '#D1FAE5' : `${Colors.primary}15` }]}>
              <Text style={[st.statusBadgeText, { color: summary.isCompleted ? '#10B981' : Colors.primary }]}>
                {summary.isCompleted ? 'COMPLETED' : 'ONGOING'}
              </Text>
            </View>
          </View>

          <View style={st.statsGrid}>
            <View style={st.statBox}>
              <Text style={st.statLabel}>TOTAL PAID</Text>
              <Text style={st.statVal}>{formatPaise(summary.totalPaid)}</Text>
            </View>
            <View style={st.statBox}>
              <Text style={st.statLabel}>OUTSTANDING</Text>
              <Text style={[st.statVal, { color: summary.totalOutstanding > 0 ? '#EF4444' : '#10B981' }]}>
                {formatPaise(summary.totalOutstanding)}
              </Text>
            </View>
            <View style={st.statBox}>
              <Text style={st.statLabel}>MONTHS PAID</Text>
              <Text style={st.statVal}>{summary.monthsPaid}/{summary.durationMonths}</Text>
            </View>
            <View style={st.statBox}>
              <Text style={st.statLabel}>CHIT VALUE</Text>
              <Text style={st.statVal}>{formatPaise(summary.totalValue)}</Text>
            </View>
          </View>

          <View style={st.progressTrack}>
            <View style={[st.progressFill, { width: `${summary.progressPct}%` as any }]} />
          </View>
          <Text style={st.progressCaption}>{summary.progressPct}% of tenure completed</Text>
        </View>

        <DonutChart detail={data} />
        <MonthBarChart detail={data} />

        <Text style={st.sectionTitle}>Month-wise Payment Details</Text>
        {data.months.map((m) => {
          const statusColor = getStatusColor(m.status);
          return (
            <View
              key={m.monthNumber}
              style={[st.monthCard, m.isMemberWinner && st.monthCardWinner]}
            >
              <View style={st.monthHeader}>
                <View style={[
                  st.monthBadge,
                  { backgroundColor: m.isMemberWinner ? WINNER_HIGHLIGHT.badgeBg : `${statusColor}18` },
                ]}>
                  <Text style={[
                    st.monthBadgeText,
                    { color: m.isMemberWinner ? WINNER_HIGHLIGHT.badgeText : statusColor },
                  ]}>
                    M{m.monthNumber}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.monthTitle, m.isMemberWinner && { color: WINNER_HIGHLIGHT.text }]}>
                    Auction / Month {m.monthNumber}
                  </Text>
                  <Text style={st.monthSub}>{m.sourceLabel}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {m.isMemberWinner && (
                    <View style={st.winnerPill}>
                      <Text style={st.winnerPillText}>WINNER</Text>
                    </View>
                  )}
                  <View style={[st.monthStatusPill, { backgroundColor: `${statusColor}18` }]}>
                    <Text style={[st.monthStatusText, { color: statusColor }]}>
                      {getStatusLabel(m.status).toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={st.monthGrid}>
                <View style={st.monthCell}>
                  <Text style={st.monthCellLabel}>DUE</Text>
                  <Text style={st.monthCellVal}>
                    {m.dueAmount != null ? formatPaise(m.dueAmount) : '—'}
                  </Text>
                </View>
                <View style={st.monthCell}>
                  <Text style={st.monthCellLabel}>PAID</Text>
                  <Text style={[st.monthCellVal, { color: Colors.primary }]}>
                    {formatPaise(m.paidAmount)}
                  </Text>
                </View>
                <View style={st.monthCell}>
                  <Text style={st.monthCellLabel}>BALANCE</Text>
                  <Text style={st.monthCellVal}>
                    {m.dueAmount != null
                      ? formatPaise(Math.max(0, m.dueAmount - m.paidAmount))
                      : '—'}
                  </Text>
                </View>
                <View style={st.monthCell}>
                  <Text style={st.monthCellLabel}>DATE</Text>
                  <Text style={st.monthCellVal}>
                    {m.paidAt
                      ? new Date(m.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </Text>
                </View>
              </View>

              {m.status === 'awaiting_auction' && (
                <Text style={st.monthNote}>
                  Payable amount will appear after auction #{m.monthNumber} is settled.
                </Text>
              )}
              {isUnaccounted && m.paidAmount > 0 && (
                <Text style={st.monthNote}>
                  Recorded by admin via cash collection.
                </Text>
              )}
              {m.isMemberWinner && m.winnerPrizeAmount != null && m.winnerPrizeAmount > 0 && (
                <Text style={st.winnerNote}>
                  Prize received · {formatPaise(m.winnerPrizeAmount)}
                </Text>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={st.exportFullBtn} onPress={handleExport}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </Svg>
          <Text style={st.exportFullBtnText}>Export Group History</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { flex: 1, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.primary, marginHorizontal: 8 },
  exportBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 16 },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle,
  },
  summaryCardUnaccounted: {
    backgroundColor: UNAUTHORED_THEME.bg,
    borderColor: UNAUTHORED_THEME.border,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  summaryName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#0B1C30' },
  summaryMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748B', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  statusBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statBox: {
    width: '47%', backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#F1F5F9',
  },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.6, marginBottom: 4 },
  statVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#0B1C30' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 100 },
  progressCaption: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A3B8', marginTop: 6 },

  chartCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle,
  },
  sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#0B1C30', marginBottom: 14 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  donutWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutCenterLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#94A3B8', letterSpacing: 0.5 },
  donutCenterVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: Colors.primary, marginTop: 2 },
  legend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748B' },
  legendVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#0B1C30' },
  legendPct: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.primary },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 90, paddingTop: 8 },
  barCol: { alignItems: 'center', flex: 1, gap: 6 },
  bar: { width: 14, borderRadius: 6, minHeight: 6 },
  barLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#94A3B8' },

  monthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 10, ...Shadows.subtle,
  },
  monthCardWinner: {
    backgroundColor: WINNER_HIGHLIGHT.bg,
    borderColor: WINNER_HIGHLIGHT.borderStrong,
    borderWidth: 2,
  },
  winnerPill: {
    backgroundColor: WINNER_HIGHLIGHT.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: WINNER_HIGHLIGHT.border,
  },
  winnerPillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: WINNER_HIGHLIGHT.badgeText,
    letterSpacing: 0.6,
  },
  winnerNote: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: WINNER_HIGHLIGHT.text,
    marginTop: 8,
  },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  monthBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  monthTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  monthSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A3B8', marginTop: 2 },
  monthStatusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  monthStatusText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.4 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: {
    width: '47%', backgroundColor: '#F8FAFC', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: '#F1F5F9',
  },
  monthCellLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#94A3B8', letterSpacing: 0.5, marginBottom: 3 },
  monthCellVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#0B1C30' },
  monthNote: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748B',
    marginTop: 10, fontStyle: 'italic', lineHeight: 16,
  },

  exportFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  exportFullBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' },
});