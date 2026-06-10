import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { formatPaise } from '../../../lib/hooks/useDashboard';
import {
  EMPTY_COLLECTION_PIE_DATA,
  formatMomLabel,
  type CollectionPieData,
  type PieSlice,
} from '../../../lib/dashboardAnalytics';

type Props = {
  data: CollectionPieData;
  selectedIndex: number | null;
  onSelectSlice: (index: number | null) => void;
};

function SliceDetailPanel({ slice, total6M }: { slice: PieSlice; total6M: number }) {
  const onlinePct = slice.amount > 0
    ? Math.round((slice.installmentAmount / slice.amount) * 100)
    : 0;
  const cashPct = slice.amount > 0
    ? Math.round((slice.cashAmount / slice.amount) * 100)
    : 0;

  return (
    <View style={st.detailPanel}>
      <View style={st.detailHeader}>
        <View style={[st.detailDot, { backgroundColor: slice.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={st.detailTitle}>{slice.fullLabel}</Text>
          <Text style={st.detailSub}>
            {slice.percent}% of 6-month total · {slice.txnCount} collection{slice.txnCount === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={st.detailAmount}>{formatPaise(slice.amount)}</Text>
      </View>

      {slice.amount > 0 ? (
        <>
          <View style={st.sourceSplitRow}>
            <View style={st.sourceSplitItem}>
              <Text style={st.sourceSplitLabel}>ONLINE</Text>
              <Text style={st.sourceSplitVal}>{formatPaise(slice.installmentAmount)}</Text>
              <Text style={st.sourceSplitMeta}>{slice.installmentCount} txns · {onlinePct}%</Text>
            </View>
            <View style={st.sourceSplitDivider} />
            <View style={st.sourceSplitItem}>
              <Text style={st.sourceSplitLabel}>CASH</Text>
              <Text style={st.sourceSplitVal}>{formatPaise(slice.cashAmount)}</Text>
              <Text style={st.sourceSplitMeta}>{slice.cashCount} entries · {cashPct}%</Text>
            </View>
          </View>

          <View style={st.splitBarTrack}>
            <View style={[st.splitBarOnline, { width: `${onlinePct}%` as any }]} />
            <View style={[st.splitBarCash, { width: `${cashPct}%` as any }]} />
          </View>
        </>
      ) : (
        <Text style={st.noDataNote}>No collections recorded this month.</Text>
      )}

      <View style={st.detailFooter}>
        <View style={st.detailStat}>
          <Text style={st.detailStatLabel}>VS PREV MONTH</Text>
          <Text style={[
            st.detailStatVal,
            { color: (slice.momChangePct ?? 0) >= 0 ? '#006A65' : '#BA1A1A' },
          ]}>
            {formatMomLabel(slice.momChangePct)}
          </Text>
        </View>
        <View style={st.detailStat}>
          <Text style={st.detailStatLabel}>SHARE OF TOTAL</Text>
          <Text style={st.detailStatVal}>{slice.percent}%</Text>
        </View>
        <View style={st.detailStat}>
          <Text style={st.detailStatLabel}>6M TOTAL</Text>
          <Text style={st.detailStatVal}>{formatPaise(total6M)}</Text>
        </View>
      </View>
    </View>
  );
}

function OverviewPanel({ data }: { data: CollectionPieData }) {
  const { summary, sourceTotal } = data;

  return (
    <View style={st.detailPanel}>
      <Text style={st.overviewTitle}>6-Month Overview</Text>
      <Text style={st.overviewSub}>
        {summary.totalTxnCount} collections across {summary.rangeLabel}
      </Text>

      <View style={st.sourceSplitRow}>
        <View style={st.sourceSplitItem}>
          <Text style={st.sourceSplitLabel}>ONLINE INSTALLMENTS</Text>
          <Text style={st.sourceSplitVal}>{formatPaise(sourceTotal.installment)}</Text>
          <Text style={st.sourceSplitMeta}>{sourceTotal.installmentPct}% of total</Text>
        </View>
        <View style={st.sourceSplitDivider} />
        <View style={st.sourceSplitItem}>
          <Text style={st.sourceSplitLabel}>CASH COLLECTIONS</Text>
          <Text style={st.sourceSplitVal}>{formatPaise(sourceTotal.cash)}</Text>
          <Text style={st.sourceSplitMeta}>{sourceTotal.cashPct}% of total</Text>
        </View>
      </View>

      <View style={st.splitBarTrack}>
        <View style={[st.splitBarOnline, { width: `${sourceTotal.installmentPct}%` as any }]} />
        <View style={[st.splitBarCash, { width: `${sourceTotal.cashPct}%` as any }]} />
      </View>

      {summary.peakMonth && (
        <View style={st.peakBanner}>
          <Text style={st.peakBannerLabel}>PEAK MONTH</Text>
          <Text style={st.peakBannerVal}>
            {summary.peakMonth.shortLabel} · {formatPaise(summary.peakMonth.amount)}
          </Text>
        </View>
      )}
    </View>
  );
}

export function CollectionPieChart({ data, selectedIndex, onSelectSlice }: Props) {
  const safeData = data?.slices?.length ? data : EMPTY_COLLECTION_PIE_DATA;
  const safeIndex =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < safeData.slices.length
      ? selectedIndex
      : null;
  const selectedSlice = safeIndex != null ? safeData.slices[safeIndex] : null;

  const handleSlicePress = (index: number) => {
    Haptics.selectionAsync();
    onSelectSlice(safeIndex === index ? null : index);
  };

  return (
    <View>
      <View style={st.pieRow}>
        <View style={st.pieWrap}>
          <Svg width={200} height={200} viewBox="0 0 200 200">
            <Circle cx={100} cy={100} r={82} fill="#F8FAFC" />
            {safeData.slices.map((slice) => {
              const isSelected = safeIndex === slice.index;
              const isDimmed = safeIndex != null && !isSelected;
              return (
                <Path
                  key={slice.id}
                  d={slice.path}
                  fill={slice.color}
                  opacity={isDimmed ? 0.35 : 1}
                  stroke={isSelected ? '#FFFFFF' : 'transparent'}
                  strokeWidth={isSelected ? 3 : 0}
                  onPress={() => handleSlicePress(slice.index)}
                />
              );
            })}
            <Circle cx={100} cy={100} r={50} fill="#FFFFFF" />
          </Svg>

          <Pressable
            style={st.pieCenter}
            onPress={() => {
              Haptics.selectionAsync();
              onSelectSlice(null);
            }}
          >
            {selectedSlice ? (
              <>
                <Text style={st.centerLabel}>{selectedSlice.shortLabel}</Text>
                <Text style={st.centerVal}>{formatPaise(selectedSlice.amount)}</Text>
                <Text style={st.centerSub}>{selectedSlice.percent}%</Text>
              </>
            ) : (
              <>
                <Text style={st.centerLabel}>6M TOTAL</Text>
                <Text style={st.centerVal}>{formatPaise(safeData.summary.total6M)}</Text>
                <Text style={st.centerSub}>Tap a slice</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={st.legend}>
          {safeData.slices.map((slice) => {
            const active = safeIndex === slice.index;
            return (
              <Pressable
                key={slice.id}
                style={[st.legendItem, active && st.legendItemActive]}
                onPress={() => handleSlicePress(slice.index)}
              >
                <View style={[st.legendDot, { backgroundColor: slice.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.legendLabel, active && st.legendLabelActive]}>
                    {slice.shortLabel}
                  </Text>
                  <Text style={st.legendSub}>
                    {slice.txnCount} txn{slice.txnCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[st.legendVal, active && st.legendValActive]}>
                    {formatPaise(slice.amount)}
                  </Text>
                  <Text style={st.legendPct}>{slice.percent}%</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedSlice ? (
        <SliceDetailPanel slice={selectedSlice} total6M={safeData.summary.total6M} />
      ) : (
        <OverviewPanel data={safeData} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pieWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  pieCenter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  centerVal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: '#005E7D',
    marginTop: 2,
    textAlign: 'center',
  },
  centerSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 2,
  },

  legend: { flex: 1, gap: 6 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  legendItemActive: { backgroundColor: '#F0F9FF' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748B' },
  legendLabelActive: { color: '#005E7D' },
  legendSub: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#94A3B8', marginTop: 1 },
  legendVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#0B1C30' },
  legendValActive: { color: '#005E7D' },
  legendPct: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#94A3B8' },

  detailPanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  detailDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  detailTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#0B1C30' },
  detailSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 2 },
  detailAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#005E7D' },

  sourceSplitRow: { flexDirection: 'row', marginBottom: 10 },
  sourceSplitItem: { flex: 1 },
  sourceSplitDivider: { width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 10 },
  sourceSplitLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sourceSplitVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#0B1C30' },
  sourceSplitMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94A3B8', marginTop: 2 },

  splitBarTrack: {
    height: 8,
    borderRadius: 100,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  splitBarOnline: { height: '100%', backgroundColor: '#005E7D' },
  splitBarCash: { height: '100%', backgroundColor: '#10D7CD' },

  noDataNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 14,
  },

  detailFooter: { flexDirection: 'row', gap: 8 },
  detailStat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailStatLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#94A3B8',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  detailStatVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#0B1C30' },

  overviewTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#0B1C30', marginBottom: 4 },
  overviewSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginBottom: 14 },
  peakBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  peakBannerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#64748B', letterSpacing: 0.5 },
  peakBannerVal: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#006A65' },
});