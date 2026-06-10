import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../lib/constants';
import { formatPaise } from '../../lib/hooks/useDashboard';
import { useMemberSession } from '../../lib/MemberSessionContext';
import { supabase } from '../../lib/supabase';
import {
  fetchMemberGroupSummaries,
  UNAUTHORED_THEME,
  type MemberGroupSummary,
} from '../../lib/memberGroupHistory';

function GroupHistoryCard({ group, onPress }: { group: MemberGroupSummary; onPress: () => void }) {
  const isUnaccounted = group.accountingType === 'unaccounted';

  return (
    <TouchableOpacity
      style={[s.card, isUnaccounted && s.cardUnaccounted]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardCategory} numberOfLines={1}>{group.groupName.toUpperCase()}</Text>
          <Text style={s.cardName} numberOfLines={1}>{group.groupName}</Text>
          <Text style={s.cardMeta}>
            {isUnaccounted ? 'Cash Only' : 'Accounted'}
            {' · '}{group.monthsPaid}/{group.durationMonths} months paid
          </Text>
        </View>
        <View style={[
          s.badge,
          { backgroundColor: group.isCompleted ? '#D1FAE5' : `${Colors.primary}15` },
        ]}>
          <Text style={[
            s.badgeText,
            { color: group.isCompleted ? '#10B981' : Colors.primary },
          ]}>
            {group.isCompleted ? 'COMPLETED' : 'ONGOING'}
          </Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>PAID</Text>
          <Text style={s.statVal}>{formatPaise(group.totalPaid)}</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statLabel}>OUTSTANDING</Text>
          <Text style={[s.statVal, group.totalOutstanding > 0 && { color: '#EF4444' }]}>
            {formatPaise(group.totalOutstanding)}
          </Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statLabel}>PROGRESS</Text>
          <Text style={s.statVal}>{group.progressPct}%</Text>
        </View>
      </View>

      <View style={s.progressTrack}>
        <View style={[
          s.progressFill,
          {
            width: `${group.progressPct}%` as any,
            backgroundColor: isUnaccounted ? UNAUTHORED_THEME.accent : Colors.primary,
          },
        ]} />
      </View>

      <View style={s.cardFooter}>
        <Text style={s.footerHint}>Tap to view month-wise details & export</Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill={Colors.primary}>
          <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
        </Svg>
      </View>
    </TouchableOpacity>
  );
}

function useMemberGroups(memberId: string | null) {
  return useQuery({
    queryKey: ['member-group-history', memberId],
    queryFn: () => fetchMemberGroupSummaries(memberId!),
    enabled: !!memberId,
  });
}

export default function WalletScreen() {
  const router = useRouter();
  const { memberId } = useMemberSession();
  const queryClient = useQueryClient();
  const { data: groups, isLoading } = useMemberGroups(memberId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    if (!memberId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['member-group-history', memberId] });
    };

    const channel = supabase
      .channel('member-history-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_member_transactions' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_collections' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedules' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members', filter: `customer_id=eq.${memberId}` }, invalidate)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [memberId, queryClient]);

  const filtered = useMemo(() => {
    let list = groups || [];
    if (filter === 'active') list = list.filter((g) => !g.isCompleted);
    if (filter === 'completed') list = list.filter((g) => g.isCompleted);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.groupName.toLowerCase().includes(q));
    }
    return list;
  }, [groups, filter, searchQuery]);

  const activeGroups = filtered.filter((g) => !g.isCompleted);
  const completedGroups = filtered.filter((g) => g.isCompleted);

  const openGroup = (membershipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/history/${membershipId}`);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.appBar}>
        {isSearchActive ? (
          <TextInput
            style={s.searchInput}
            placeholder="Search your groups..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        ) : (
          <Text style={s.appBarTitle}>History</Text>
        )}
        <TouchableOpacity
          style={[s.iconBtn, isSearchActive && { backgroundColor: Colors.primary }]}
          onPress={() => {
            Haptics.selectionAsync();
            setIsSearchActive(!isSearchActive);
            if (isSearchActive) setSearchQuery('');
          }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={isSearchActive ? '#FFF' : Colors.primary}>
            <Path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.headerSub}>Your participating chit groups and payment history</Text>

        <View style={s.filterRow}>
          {(['all', 'active', 'completed'] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[s.chip, filter === key && s.chipActive]}
              onPress={() => { setFilter(key); Haptics.selectionAsync(); }}
            >
              <Text style={[s.chipText, filter === key && s.chipTextActive]}>
                {key === 'all' ? 'All' : key === 'active' ? 'Ongoing' : 'Completed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No groups found</Text>
            <Text style={s.emptySub}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Join a chit group to see your payment history here.'}
            </Text>
          </View>
        ) : (
          <>
            {activeGroups.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Participating Groups</Text>
                {activeGroups.map((g) => (
                  <GroupHistoryCard key={g.membershipId} group={g} onPress={() => openGroup(g.membershipId)} />
                ))}
              </View>
            )}

            {completedGroups.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Completed Groups</Text>
                {completedGroups.map((g) => (
                  <GroupHistoryCard key={g.membershipId} group={g} onPress={() => openGroup(g.membershipId)} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: {
    height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)', ...Shadows.subtle,
  },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    flex: 1, height: 40, backgroundColor: '#F1F5F9', borderRadius: 20,
    paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#0B1C30', marginRight: 12,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#64748B' },

  filterRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },

  section: { gap: 12 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle,
  },
  cardUnaccounted: {
    backgroundColor: UNAUTHORED_THEME.bg,
    borderColor: UNAUTHORED_THEME.border,
    borderWidth: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardCategory: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: Colors.primary, letterSpacing: 1.2 },
  cardName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: '#0B1C30', marginTop: 2 },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statItem: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: '#F1F5F9',
  },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#94A3B8', letterSpacing: 0.5, marginBottom: 3 },
  statVal: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#0B1C30' },

  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  footerHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },

  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  emptyTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#64748B', marginBottom: 6 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
});