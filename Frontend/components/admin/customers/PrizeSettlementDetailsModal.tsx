import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { formatDateIST, formatPaise } from './utils';

interface SettlementRow {
  id: string;
  auction_id: string;
  chit_member_id: string;
  amount: number;
  denomination_500?: number;
  denomination_200?: number;
  denomination_100?: number;
  denomination_50?: number;
  denomination_20?: number;
  denomination_10?: number;
  notes?: string | null;
  recorded_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  auction: any;
  group: any;
  winner: any;
  settlements: SettlementRow[];
}

const DENOM_LABELS = [
  { key: 'denomination_500', label: '500' },
  { key: 'denomination_200', label: '200' },
  { key: 'denomination_100', label: '100' },
  { key: 'denomination_50', label: '50' },
  { key: 'denomination_20', label: '20' },
  { key: 'denomination_10', label: '10' },
] as const;

export function PrizeSettlementDetailsModal({
  visible, onClose, auction, group, winner, settlements,
}: Props) {
  if (!auction) return null;

  const winnerId = winner?.id;
  const relevant = (settlements || []).filter(
    (s) => s.auction_id === auction.id && (!winnerId || s.chit_member_id === winnerId)
  );

  const entitled = auction.winner_prize_amount || 0;
  const disbursed = relevant.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = Math.max(0, entitled - disbursed);
  const isUnaccounted = group?.accounting_type === 'unaccounted';

  const totalDenoms: Record<string, number> = {
    denomination_500: 0, denomination_200: 0, denomination_100: 0,
    denomination_50: 0, denomination_20: 0, denomination_10: 0,
  };

  if (isUnaccounted) {
    relevant.forEach((s) => {
      DENOM_LABELS.forEach(({ key }) => {
        totalDenoms[key] += (s as any)[key] || 0;
      });
    });
  }

  const winnerName = winner?.customers?.full_name || 'Winner';
  const prizeDisplay = (entitled / 100).toLocaleString('en-IN');
  const disbursedDisplay = (disbursed / 100).toLocaleString('en-IN');
  const remainingDisplay = (remaining / 100).toLocaleString('en-IN');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
              <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </Svg>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Prize Payout Details</Text>
            <Text style={styles.subtitle}>Auction #{auction.auction_number} · {winnerName}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Entitled Prize</Text>
              <Text style={styles.summaryValue}>₹{prizeDisplay}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Disbursed</Text>
              <Text style={[styles.summaryValue, { color: '#16A34A' }]}>₹{disbursedDisplay}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Remaining to Pay</Text>
              <Text style={[styles.summaryValue, { color: remaining > 0 ? '#DC2626' : '#16A34A' }]}>
                ₹{remainingDisplay}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {remaining <= 0 ? 'FULLY SETTLED' : disbursed > 0 ? 'PARTIALLY SETTLED' : 'NO PAYOUTS RECORDED'}
              </Text>
            </View>
          </View>

          {/* Payout History */}
          <Text style={styles.sectionTitle}>Payout History ({relevant.length})</Text>

          {relevant.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No prize payouts recorded yet for this auction.</Text>
            </View>
          ) : (
            relevant.map((s, idx) => {
              const amt = (s.amount || 0) / 100;
              const hasDenoms = isUnaccounted && DENOM_LABELS.some(({ key }) => (s as any)[key] > 0);

              return (
                <View key={s.id || idx} style={styles.payoutCard}>
                  <View style={styles.payoutHeader}>
                    <Text style={styles.payoutDate}>{formatDateIST(s.recorded_at)}</Text>
                    <Text style={styles.payoutAmount}>₹{amt.toLocaleString('en-IN')}</Text>
                  </View>

                  {hasDenoms && (
                    <View style={styles.denomsRow}>
                      {DENOM_LABELS.map(({ key, label }) => {
                        const count = (s as any)[key] || 0;
                        if (count <= 0) return null;
                        return (
                          <View key={key} style={styles.denomChip}>
                            <Text style={styles.denomText}>₹{label} × {count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {s.notes ? (
                    <Text style={styles.notes}>Note: {s.notes}</Text>
                  ) : null}
                </View>
              );
            })
          )}

          {/* Unaccounted total cash breakdown */}
          {isUnaccounted && relevant.length > 0 && (
            <View style={styles.cashSummary}>
              <Text style={styles.sectionTitle}>Total Cash Denominations Disbursed</Text>
              <View style={styles.denomsRow}>
                {DENOM_LABELS.map(({ key, label }) => {
                  const total = totalDenoms[key];
                  if (total <= 0) return null;
                  return (
                    <View key={key} style={styles.denomChip}>
                      <Text style={styles.denomText}>₹{label} × {total}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
          <Text style={styles.closeFooterText}>CLOSE</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  scroll: { padding: 20, paddingBottom: 80 },
  summaryCard: {
    backgroundColor: '#F0F9FF', borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#005E7D' },
  summaryValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#0B1C30' },
  statusPill: {
    alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#DCFCE7', borderRadius: 100,
  },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#166534' },
  sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#0F172A', marginBottom: 10 },
  payoutCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  payoutHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  payoutDate: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  payoutAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#16A34A' },
  denomsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  denomChip: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  denomText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#92400E' },
  notes: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#475569', marginTop: 6, fontStyle: 'italic' },
  emptyCard: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  cashSummary: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  closeFooterBtn: {
    margin: 20, backgroundColor: '#01789E', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  closeFooterText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FFFFFF' },
});