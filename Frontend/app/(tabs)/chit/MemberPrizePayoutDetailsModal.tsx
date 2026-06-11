import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
// Self-contained format helpers (no external dep to avoid path issues)
const formatPaiseLocal = (paise: number | null | undefined) => {
  const n = Number(paise || 0);
  return `₹${(n / 100).toLocaleString('en-IN')}`;
};

const formatDateISTLocal = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

interface Props {
  visible: boolean;
  onClose: () => void;
  auction: any;
  prizeSettlements: any[];
  group: any;
}

const DENOM_LABELS = [
  { key: 'denomination_500', label: '₹500' },
  { key: 'denomination_200', label: '₹200' },
  { key: 'denomination_100', label: '₹100' },
  { key: 'denomination_50', label: '₹50' },
  { key: 'denomination_20', label: '₹20' },
  { key: 'denomination_10', label: '₹10' },
];

export function MemberPrizePayoutDetailsModal({ visible, onClose, auction, prizeSettlements, group }: Props) {
  if (!auction) return null;

  const relevant = (prizeSettlements || []).filter(
    (s: any) => s.auction_id === auction.id
  );

  const entitled = auction.winner_prize_amount || 0;
  const received = relevant.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  const remaining = Math.max(0, entitled - received);
  const isUnaccounted = group?.accounting_type === 'unaccounted';

  // For member view, we show denoms if present (the member received this cash)
  const totalDenoms: any = {
    denomination_500: 0, denomination_200: 0, denomination_100: 0,
    denomination_50: 0, denomination_20: 0, denomination_10: 0,
  };
  if (isUnaccounted) {
    relevant.forEach((s: any) => {
      DENOM_LABELS.forEach(({ key }) => {
        totalDenoms[key] += s[key] || 0;
      });
    });
  }

  const entitledR = (entitled / 100).toLocaleString('en-IN');
  const receivedR = (received / 100).toLocaleString('en-IN');
  const remainingR = (remaining / 100).toLocaleString('en-IN');

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
            <Text style={styles.subtitle}>Auction #{auction.auction_number}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.summaryCard}>
            <View style={styles.row}><Text style={styles.label}>Total Prize</Text><Text style={styles.value}>{formatPaiseLocal(entitled)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Received so far</Text><Text style={[styles.value, { color: '#16A34A' }]}>{formatPaiseLocal(received)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Still to receive</Text><Text style={[styles.value, { color: remaining > 0 ? '#DC2626' : '#16A34A' }]}>{formatPaiseLocal(remaining)}</Text></View>
            <View style={[styles.badge, remaining <= 0 ? styles.badgeGreen : styles.badgeAmber]}>
              <Text style={styles.badgeText}>{remaining <= 0 ? 'FULLY RECEIVED' : 'PARTIALLY RECEIVED'}</Text>
            </View>
          </View>

          <Text style={styles.section}>Payout History</Text>

          {relevant.length === 0 ? (
            <Text style={styles.empty}>No payouts recorded yet.</Text>
          ) : (
            relevant.map((s: any, i: number) => {
              const amt = (s.amount || 0) / 100;
              const hasD = isUnaccounted && DENOM_LABELS.some(d => (s[d.key] || 0) > 0);
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.date}>{formatDateISTLocal(s.recorded_at)}</Text>
                    <Text style={styles.amt}>{formatPaiseLocal(s.amount)}</Text>
                  </View>
                  {hasD && (
                    <View style={styles.denomRow}>
                      {DENOM_LABELS.map(d => {
                        const c = s[d.key] || 0;
                        if (!c) return null;
                        return <Text key={d.key} style={styles.denomChip}> {d.label}×{c} </Text>;
                      })}
                    </View>
                  )}
                  {s.notes ? <Text style={styles.note}>Note: {s.notes}</Text> : null}
                </View>
              );
            })
          )}

          {isUnaccounted && relevant.length > 0 && (
            <>
              <Text style={styles.section}>Total Cash Received (Denominations)</Text>
              <View style={styles.denomRow}>
                {DENOM_LABELS.map(d => {
                  const c = totalDenoms[d.key];
                  if (!c) return null;
                  return <Text key={d.key} style={styles.denomChip}> {d.label}×{c} </Text>;
                })}
              </View>
            </>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneText}>DONE</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E5E7EB' },
  closeBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#64748B', textAlign: 'center' },
  scroll: { padding: 16 },
  summaryCard: { backgroundColor: '#F0F9FF', borderRadius: 12, padding: 16, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 13, color: '#0369A1' },
  value: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  badge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeGreen: { backgroundColor: '#DCFCE7' },
  badgeAmber: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  section: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { fontSize: 12, color: '#64748B' },
  amt: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  denomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  denomChip: { fontSize: 11, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: '#92400E' },
  note: { fontSize: 11, color: '#64748B', marginTop: 4, fontStyle: 'italic' },
  empty: { color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 20 },
  doneBtn: { margin: 16, backgroundColor: '#0EA5E9', padding: 14, borderRadius: 12, alignItems: 'center' },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});