import { useEffect, useState, useRef } from 'react';
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
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [filterMode, setFilterMode] = useState<'all' | 'paid' | 'due' | 'future'>('all');

  const defaultMonth = detail.months.find(
    (m) => m.status === 'partial' || m.status === 'pending'
  )?.monthNumber || detail.summary.currentMonth || 1;

  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const scrollRef = useRef<ScrollView>(null);

  const monthlyInstallment = detail.summary.monthlyInstallment || 2500000;
  const paidCount = detail.months.filter((m) => m.status === 'paid').length;
  const partialCount = detail.months.filter((m) => m.status === 'partial').length;
  const pendingCount = detail.months.filter((m) => m.status === 'pending').length;
  const awaitingCount = detail.months.filter((m) => m.status === 'awaiting_auction' || m.status === 'upcoming').length;

  const selectedRecord = detail.months.find((m) => m.monthNumber === selectedMonth) || detail.months[0];

  const maxBenchmark = Math.max(
    ...detail.months.map((m) => Math.max(m.paidAmount, m.dueAmount || 0)),
    monthlyInstallment,
    1,
  );

  // Auto-scroll on mount / viewMode switch
  useEffect(() => {
    if (scrollRef.current && selectedMonth > 2 && viewMode === 'timeline') {
      const xOffset = Math.max(0, (selectedMonth - 2) * 60);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: xOffset, animated: true });
      }, 300);
    }
  }, [viewMode]);

  const handleSelectMonth = (monthNumber: number) => {
    Haptics.selectionAsync();
    setSelectedMonth(monthNumber);
  };

  const selectedStatusColor = selectedRecord ? getStatusColor(selectedRecord.status) : Colors.primary;
  const selectedBalance = selectedRecord?.dueAmount != null
    ? Math.max(0, selectedRecord.dueAmount - selectedRecord.paidAmount)
    : 0;

  const displayedMonths = detail.months.filter((m) => {
    if (filterMode === 'paid') return m.status === 'paid';
    if (filterMode === 'due') return m.status === 'partial' || m.status === 'pending';
    if (filterMode === 'future') return m.status === 'awaiting_auction' || m.status === 'upcoming';
    return true;
  });

  return (
    <View style={st.chartCard}>
      {/* Card Header & View Switcher */}
      <View style={st.chartHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.sectionTitle}>Month-wise Projection</Text>
          <Text style={st.chartSubTitle}>
            {detail.summary.durationMonths} Months Tenure · Est. {formatPaise(monthlyInstallment)}/mo
          </Text>
        </View>

        {/* View Mode Toggle: Timeline vs Grid */}
        <View style={st.viewToggleContainer}>
          <TouchableOpacity
            style={[st.viewToggleBtn, viewMode === 'timeline' && st.viewToggleBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setViewMode('timeline');
            }}
          >
            <Text style={[st.viewToggleText, viewMode === 'timeline' && st.viewToggleTextActive]}>
              Timeline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.viewToggleBtn, viewMode === 'grid' && st.viewToggleBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setViewMode('grid');
            }}
          >
            <Text style={[st.viewToggleText, viewMode === 'grid' && st.viewToggleTextActive]}>
              Grid
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter / Stage Segmented Pills */}
      <View style={st.statusSummaryRow}>
        <TouchableOpacity
          onPress={() => setFilterMode('all')}
          style={[st.summaryChip, filterMode === 'all' && st.summaryChipActive]}
        >
          <Text style={[st.summaryChipText, filterMode === 'all' && st.summaryChipTextActive]}>
            All ({detail.months.length})
          </Text>
        </TouchableOpacity>

        {paidCount > 0 && (
          <TouchableOpacity
            onPress={() => setFilterMode(filterMode === 'paid' ? 'all' : 'paid')}
            style={[
              st.summaryChip,
              { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
              filterMode === 'paid' && { backgroundColor: '#10B981', borderColor: '#10B981' },
            ]}
          >
            <View style={[st.summaryChipDot, { backgroundColor: filterMode === 'paid' ? '#FFFFFF' : CHART_COLORS.paid }]} />
            <Text style={[st.summaryChipText, { color: filterMode === 'paid' ? '#FFFFFF' : '#065F46' }]}>
              {paidCount} Paid
            </Text>
          </TouchableOpacity>
        )}

        {(partialCount > 0 || pendingCount > 0) && (
          <TouchableOpacity
            onPress={() => setFilterMode(filterMode === 'due' ? 'all' : 'due')}
            style={[
              st.summaryChip,
              { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
              filterMode === 'due' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
            ]}
          >
            <View style={[st.summaryChipDot, { backgroundColor: filterMode === 'due' ? '#FFFFFF' : CHART_COLORS.partial }]} />
            <Text style={[st.summaryChipText, { color: filterMode === 'due' ? '#FFFFFF' : '#92400E' }]}>
              {partialCount + pendingCount} Due
            </Text>
          </TouchableOpacity>
        )}

        {awaitingCount > 0 && (
          <TouchableOpacity
            onPress={() => setFilterMode(filterMode === 'future' ? 'all' : 'future')}
            style={[
              st.summaryChip,
              { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
              filterMode === 'future' && { backgroundColor: '#475569', borderColor: '#475569' },
            ]}
          >
            <View style={[st.summaryChipDot, { backgroundColor: filterMode === 'future' ? '#FFFFFF' : CHART_COLORS.awaiting }]} />
            <Text style={[st.summaryChipText, { color: filterMode === 'future' ? '#FFFFFF' : '#64748B' }]}>
              {awaitingCount} Future
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* VIEW 1: TIMELINE HORIZONTAL SCROLL VIEW */}
      {viewMode === 'timeline' && (
        <View style={st.chartWrapper}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.barScrollContent}
          >
            {displayedMonths.map((m) => {
              const isSelected = m.monthNumber === selectedMonth;
              const statusColor = getStatusColor(m.status);

              // Projected installment height vs actual paid
              const targetDue = m.dueAmount != null ? m.dueAmount : monthlyInstallment;
              const trackHeight = Math.max(24, Math.min(90, (targetDue / maxBenchmark) * 90));

              let fillRatio = 0;
              if (m.status === 'paid') {
                fillRatio = 1.0;
              } else if (m.paidAmount > 0) {
                fillRatio = Math.min(1.0, m.paidAmount / targetDue);
              } else if (m.status === 'pending') {
                fillRatio = 0.35;
              } else {
                fillRatio = 0.15; // future estimated baseline
              }

              const fillHeight = Math.max(8, fillRatio * trackHeight);

              return (
                <TouchableOpacity
                  key={m.monthNumber}
                  onPress={() => handleSelectMonth(m.monthNumber)}
                  activeOpacity={0.75}
                  style={[
                    st.barColumn,
                    isSelected && st.barColumnSelected,
                  ]}
                >
                  {/* Winner Crown or Pointer Dot */}
                  <View style={st.barTopIconWrap}>
                    {m.isMemberWinner ? (
                      <Text style={st.winnerTrophyIcon}>🏆</Text>
                    ) : isSelected ? (
                      <View style={[st.selectedPointerDot, { backgroundColor: Colors.primary }]} />
                    ) : null}
                  </View>

                  {/* Dual Layer Projected Bar */}
                  <View
                    style={[
                      st.barTrack,
                      { height: trackHeight },
                      isSelected && { borderColor: Colors.primary, borderWidth: 1.5 },
                      m.status === 'awaiting_auction' && st.barTrackFuture,
                    ]}
                  >
                    <View
                      style={[
                        st.barFill,
                        {
                          height: fillHeight,
                          backgroundColor: statusColor,
                        },
                        m.status === 'awaiting_auction' && { backgroundColor: '#CBD5E1' },
                      ]}
                    >
                      {m.status === 'paid' && (
                        <Svg width={10} height={10} viewBox="0 0 24 24" fill="#FFFFFF" style={{ marginTop: 2 }}>
                          <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </Svg>
                      )}
                    </View>
                  </View>

                  {/* Month Label Pill */}
                  <View style={[
                    st.monthLabelPill,
                    isSelected && { backgroundColor: Colors.primary },
                  ]}>
                    <Text style={[
                      st.monthLabelText,
                      isSelected && { color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
                    ]}>
                      M{m.monthNumber}
                    </Text>
                  </View>

                  {/* Short Amount / Status Hint */}
                  <Text style={st.barAmountHint} numberOfLines={1}>
                    {m.paidAmount > 0
                      ? `₹${Math.round(m.paidAmount / 100000)}k`
                      : m.dueAmount != null
                      ? `₹${Math.round(m.dueAmount / 100000)}k`
                      : 'Est.'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* VIEW 2: 20-MONTH ALL-IN-ONE MATRIX GRID VIEW */}
      {viewMode === 'grid' && (
        <View style={st.matrixGrid}>
          {displayedMonths.map((m) => {
            const isSelected = m.monthNumber === selectedMonth;
            const statusColor = getStatusColor(m.status);

            return (
              <TouchableOpacity
                key={m.monthNumber}
                onPress={() => handleSelectMonth(m.monthNumber)}
                activeOpacity={0.75}
                style={[
                  st.gridTile,
                  { borderColor: isSelected ? Colors.primary : '#E2E8F0' },
                  isSelected && { backgroundColor: `${Colors.primary}0C`, borderWidth: 2 },
                ]}
              >
                <View style={st.gridTileHeader}>
                  <Text style={[st.gridTileMonth, isSelected && { color: Colors.primary }]}>
                    M{m.monthNumber}
                  </Text>
                  {m.isMemberWinner ? (
                    <Text style={{ fontSize: 10 }}>🏆</Text>
                  ) : (
                    <View style={[st.gridTileDot, { backgroundColor: statusColor }]} />
                  )}
                </View>

                <Text style={st.gridTileAmount} numberOfLines={1}>
                  {m.paidAmount > 0
                    ? formatPaise(m.paidAmount)
                    : m.dueAmount != null
                    ? formatPaise(m.dueAmount)
                    : `Est. ${formatPaise(monthlyInstallment)}`}
                </Text>

                <Text style={[st.gridTileStatus, { color: statusColor }]} numberOfLines={1}>
                  {getStatusLabel(m.status).toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selected Month Interactive Details Callout Inspector */}
      {selectedRecord && (
        <View style={[
          st.inspectorCard,
          selectedRecord.isMemberWinner && {
            borderColor: WINNER_HIGHLIGHT.borderStrong,
            borderWidth: 1.5,
            backgroundColor: WINNER_HIGHLIGHT.bg,
          },
        ]}>
          <View style={st.inspectorHeader}>
            <View style={st.inspectorHeaderLeft}>
              <View style={[
                st.inspectorBadge,
                { backgroundColor: selectedRecord.isMemberWinner ? WINNER_HIGHLIGHT.badgeBg : `${selectedStatusColor}18` },
              ]}>
                <Text style={[
                  st.inspectorBadgeText,
                  { color: selectedRecord.isMemberWinner ? WINNER_HIGHLIGHT.badgeText : selectedStatusColor },
                ]}>
                  M{selectedRecord.monthNumber}
                </Text>
              </View>
              <View>
                <Text style={st.inspectorTitle}>Auction / Month {selectedRecord.monthNumber}</Text>
                <Text style={st.inspectorSub}>
                  {selectedRecord.sourceLabel} · {selectedRecord.status === 'awaiting_auction' ? 'Estimated Projection' : 'Settled Installment'}
                </Text>
              </View>
            </View>

            <View style={[st.inspectorStatusPill, { backgroundColor: `${selectedStatusColor}18` }]}>
              <Text style={[st.inspectorStatusText, { color: selectedStatusColor }]}>
                {getStatusLabel(selectedRecord.status).toUpperCase()}
              </Text>
            </View>
          </View>

          {selectedRecord.isMemberWinner && (
            <View style={st.inspectorWinnerBanner}>
              <Text style={st.inspectorWinnerBannerText}>
                🏆 You won this auction · Prize {selectedRecord.winnerPrizeAmount ? formatPaise(selectedRecord.winnerPrizeAmount) : ''}
              </Text>
            </View>
          )}

          <View style={st.inspectorStatsGrid}>
            <View style={st.inspectorStatBox}>
              <Text style={st.inspectorStatLabel}>
                {selectedRecord.dueAmount != null ? 'NET DUE' : 'EST. INSTALLMENT'}
              </Text>
              <Text style={st.inspectorStatVal}>
                {selectedRecord.dueAmount != null
                  ? formatPaise(selectedRecord.dueAmount)
                  : formatPaise(monthlyInstallment)}
              </Text>
            </View>
            <View style={st.inspectorStatBox}>
              <Text style={st.inspectorStatLabel}>TOTAL PAID</Text>
              <Text style={[st.inspectorStatVal, { color: CHART_COLORS.paid }]}>
                {formatPaise(selectedRecord.paidAmount)}
              </Text>
            </View>
            <View style={st.inspectorStatBox}>
              <Text style={st.inspectorStatLabel}>BALANCE</Text>
              <Text style={[st.inspectorStatVal, { color: selectedBalance > 0 ? CHART_COLORS.pending : '#64748B' }]}>
                {selectedRecord.dueAmount != null ? formatPaise(selectedBalance) : '—'}
              </Text>
            </View>
          </View>

          {selectedRecord.paidAt ? (
            <Text style={st.inspectorDateText}>
              ✓ Paid on {new Date(selectedRecord.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          ) : selectedRecord.status === 'awaiting_auction' ? (
            <Text style={st.inspectorAwaitingHint}>
              ⏱️ Payable amount will be settled after auction #{selectedRecord.monthNumber} bidding completes.
            </Text>
          ) : null}
        </View>
      )}
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

  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartSubTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.subtle,
  },
  viewToggleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#64748B',
  },
  viewToggleTextActive: {
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  statusSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 5,
  },
  summaryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  summaryChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#475569',
  },
  summaryChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  chartWrapper: {
    height: 165,
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  barScrollContent: {
    paddingHorizontal: 4,
    alignItems: 'flex-end',
  },
  barColumn: {
    width: 54,
    alignItems: 'center',
    marginRight: 6,
    borderRadius: 12,
    paddingVertical: 4,
  },
  barColumnSelected: {
    backgroundColor: '#F1F5F9',
  },
  barTopIconWrap: {
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  winnerTrophyIcon: {
    fontSize: 12,
  },
  selectedPointerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  barTrack: {
    width: 32,
    height: 84,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  barTrackFuture: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  monthLabelPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginTop: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  monthLabelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#64748B',
  },
  barAmountHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Matrix Grid View
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  gridTile: {
    width: '23%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  gridTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gridTileMonth: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#0B1C30',
  },
  gridTileDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gridTileAmount: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 10,
    color: '#334155',
    marginBottom: 2,
  },
  gridTileStatus: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 0.3,
  },

  inspectorCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inspectorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inspectorBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectorBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  inspectorTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#0B1C30',
  },
  inspectorSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#94A3B8',
  },
  inspectorStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  inspectorStatusText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.4,
  },
  inspectorWinnerBanner: {
    backgroundColor: WINNER_HIGHLIGHT.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  inspectorWinnerBannerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: WINNER_HIGHLIGHT.badgeText,
  },
  inspectorStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  inspectorStatBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  inspectorStatLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inspectorStatVal: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 12,
    color: '#0B1C30',
  },
  inspectorDateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#10B981',
    marginTop: 8,
    textAlign: 'center',
  },
  inspectorAwaitingHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },

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