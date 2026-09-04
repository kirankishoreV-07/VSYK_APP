import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { Colors, Shadows } from '../../lib/constants';
import { formatPaise } from '../../lib/hooks/useDashboard';

type FilterKey = 'short' | 'high_return' | 'all';

type ChitGroup = {
  id: string; name: string; value: number;
  duration_months: number; monthly_installment: number; status: string;
};

/** Transparent, rule-based fit labels — not a score, not "AI". Each label
 * states the real fact it's based on so nothing is presented as inferred. */
function fitLabels(g: ChitGroup, filter: FilterKey): string[] {
  const labels: string[] = [];
  if (g.duration_months <= 12) labels.push('Short tenure');
  if (g.value >= 500000) labels.push('High value');
  if (filter === 'short' && g.duration_months <= 12) labels.push('Matches filter');
  if (filter === 'high_return' && g.value >= 500000) labels.push('Matches filter');
  return labels;
}

function sortWeight(g: ChitGroup, filter: FilterKey): number {
  if (filter === 'short') return g.duration_months <= 12 ? 1 : 0;
  if (filter === 'high_return') return g.value >= 500000 ? 1 : 0;
  return 0;
}

/** Illustrative payout range, not a fake-precise figure — the real payout
 * depends on auction bidding and is never knowable in advance. */
function payoutRange(value: number): { low: number; high: number } {
  return { low: Math.round(value * 0.85), high: Math.round(value * 0.95) };
}

import { useMemberSession } from '../../lib/MemberSessionContext';

function useAvailableChits() {
  const { memberId } = useMemberSession();
  return useQuery<ChitGroup[]>({
    queryKey: ['available-chits', memberId],
    queryFn: async () => {
      if (!memberId) return [];
      
      // Get groups the member is NOT already in
      const { data: mine } = await supabase.from('chit_members').select('chit_group_id').eq('customer_id', memberId);
      const joined = (mine ?? []).map((m: any) => m.chit_group_id);
      
      let q = supabase.from('chit_groups').select('*').eq('status', 'active').order('value', { ascending: false });
      if (joined.length > 0) q = q.not('id', 'in', `(${joined.join(',')})`);
      
      const { data, error } = await q.limit(10);
      if (error) throw error;
      return (data ?? []) as ChitGroup[];
    },
    enabled: !!memberId,
  });
}

function useJoinChit() {
  const qc = useQueryClient();
  const { memberId } = useMemberSession();

  return useMutation({
    mutationFn: async (chitGroupId: string) => {
      if (!memberId) throw new Error('Not authenticated');
      
      const { error } = await supabase.from('chit_members').insert({ 
        chit_group_id: chitGroupId, 
        customer_id: memberId,
        participation_type: 'full',
        participation_share: 1.0,
      });
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-chits'] });
      qc.invalidateQueries({ queryKey: ['available-chits'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });
}

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'short', label: 'Short Term', icon: '⚡' },
  { key: 'high_return', label: 'High Return', icon: '📈' },
  { key: 'all', label: 'All', icon: '🔍' },
];

export default function JoinChitScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('short');
  const queryClient = useQueryClient();
  const { data: chits, isLoading } = useAvailableChits();
  const { mutate: joinChit, isPending } = useJoinChit();

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['available-chits'] });
      queryClient.invalidateQueries({ queryKey: ['active-chits'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    const channel = supabase
      .channel('member-join-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_groups' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const sorted = [...(chits ?? [])].sort((a, b) => sortWeight(b, filter) - sortWeight(a, filter));

  const handleJoin = (chit: ChitGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Join Chit',
      `Join "${chit.name}" for ${formatPaise(chit.monthly_installment)}/month for ${chit.duration_months} months?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Join', style: 'default', onPress: () => joinChit(chit.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back(); }} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}><Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></Svg>
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Join a Chit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.aiHeader}>
          <View style={s.aiIconRow}>
            <View style={s.aiIcon}>
              <Text style={{ fontSize: 18 }}>🔍</Text>
            </View>
            <Text style={s.aiLabel}>RECOMMENDED FOR YOU</Text>
          </View>
          <Text style={s.heroTitle}>Available Chit Groups</Text>
          <Text style={s.heroSub}>Groups matching your selected filter, sorted first. Payout figures below are illustrative — the actual amount depends on auction bidding.</Text>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} style={[s.chip, filter === f.key && s.chipActive]}
              onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }} activeOpacity={0.8}>
              <Text>{f.icon}</Text>
              <Text style={[s.chipTxt, filter === f.key && s.chipTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cards */}
        <Text style={s.sectionTitle}>Best Chits for You</Text>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : sorted.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 32 }}>🎉</Text>
            <Text style={s.emptyTitle}>You've joined all available chits!</Text>
            <Text style={s.emptySub}>Check back later for new openings.</Text>
          </View>
        ) : (
          sorted.map((chit, idx) => {
            const labels = fitLabels(chit, filter);
            const isTop = idx === 0 && sortWeight(chit, filter) > 0;
            const range = payoutRange(chit.value);
            return (
              <View key={chit.id} style={[s.card, isTop && s.cardTop]}>
                {/* Fit labels — plain facts, not a score */}
                {labels.length > 0 && (
                  <View style={s.fitLabelRow}>
                    {labels.map((label) => (
                      <View key={label} style={[s.fitChip, isTop && s.fitChipTop]}>
                        <Text style={[s.fitChipText, isTop && s.fitChipTextTop]}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Header */}
                <Text style={s.cardCategory}>{chit.name.toUpperCase().substring(0, 20)}</Text>
                <Text style={s.cardValue}>{formatPaise(chit.value)} Total</Text>

                {/* Stats */}
                <View style={s.statsGrid}>
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>TENURE</Text>
                    <Text style={s.statVal}>{chit.duration_months} Months</Text>
                  </View>
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>ILLUSTRATIVE PAYOUT</Text>
                    <Text style={s.statVal}>{formatPaise(range.low)}–{formatPaise(range.high)}</Text>
                  </View>
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>MONTHLY</Text>
                    <Text style={s.statVal}>{formatPaise(chit.monthly_installment)}</Text>
                  </View>
                </View>

                {/* CTA */}
                <TouchableOpacity
                  style={[s.joinBtn, isTop && s.joinBtnPrimary]}
                  onPress={() => handleJoin(chit)}
                  disabled={isPending}
                  activeOpacity={0.85}
                >
                  {isPending
                    ? <ActivityIndicator color={isTop ? Colors.primary : Colors.primary} size="small" />
                    : <Text style={[s.joinTxt, isTop && s.joinTxtPrimary]}>{isTop ? 'Join This Chit' : 'View Details'}</Text>
                  }
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Explanation */}
        <View style={s.aiCard}>
          <View style={s.aiCardIcon}>
            <Text style={{ fontSize: 20 }}>ℹ️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.aiCardTitle}>How this list is ordered</Text>
            <Text style={s.aiCardSub}>Groups matching your selected filter (tenure or value) are shown first. Payout ranges are illustrative only — the actual amount a member receives depends on that month's auction bidding, not a fixed formula.</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)', ...Shadows.subtle },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },

  aiHeader: { gap: 6 },
  aiIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  aiLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.secondary, letterSpacing: 1 },
  heroTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: '#0B1C30', letterSpacing: -0.5 },
  heroSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#64748B', lineHeight: 21 },

  filterRow: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  chipTxtActive: { color: '#FFF' },

  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: '#F1F5F9', position: 'relative', overflow: 'hidden', ...Shadows.subtle },
  cardTop: { borderColor: Colors.secondary, borderWidth: 2 },
  fitLabelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fitChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: '#F1F5F9' },
  fitChipTop: { backgroundColor: 'rgba(1,120,158,0.12)' },
  fitChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B' },
  fitChipTextTop: { color: Colors.secondary },
  cardCategory: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  cardValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#0B1C30', letterSpacing: -0.5 },

  statsGrid: { flexDirection: 'row', gap: 0 },
  statCol: { flex: 1, gap: 2 },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  statVal: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },

  joinBtn: { width: '100%', paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  joinBtnPrimary: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  joinTxt: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase' },
  joinTxtPrimary: { color: Colors.primary },

  aiCard: { backgroundColor: 'rgba(1,120,158,0.05)', borderRadius: 20, padding: 16, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: 'rgba(1,120,158,0.1)' },
  aiCardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiCardTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#0B1C30', marginBottom: 4 },
  aiCardSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748B', lineHeight: 20 },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.primary },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8' },
});
