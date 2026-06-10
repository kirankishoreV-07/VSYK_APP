import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../lib/constants';
import { UNAUTHORED_THEME } from '../../lib/memberGroupHistory';
import { useMemberSession } from '../../lib/MemberSessionContext';
import { useActiveChits, formatPaise, formatShortDate, type ActiveChit } from '../../lib/hooks/useDashboard';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

const { width: SW } = Dimensions.get('window');

type FilterKey = 'all' | 'active' | 'due_soon' | 'completed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Chits' },
  { key: 'active', label: 'Active' },
  { key: 'due_soon', label: 'Due Soon' },
  { key: 'completed', label: 'Completed' },
];

// ─── Helpers ──────────────────────────────────────────────────
function isDueSoon(chit: ActiveChit): boolean {
  if (!chit.next_payment) return false;
  const due = new Date(chit.next_payment.due_date);
  const diff = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
}

function isUnaccountedGroup(chit: ActiveChit): boolean {
  return chit.chit_group.accounting_type === 'unaccounted';
}

function getStatusLabel(chit: ActiveChit): string {
  if (chit.bid_status === 'completed') return 'Completed';
  if (chit.bid_status === 'bidding') return 'Bidding';
  if (isDueSoon(chit)) return 'Due Soon';
  if (isUnaccountedGroup(chit)) return 'Cash Only';
  return 'Active';
}

function getStatusColor(label: string, isUnaccounted: boolean): string {
  if (label === 'Cash Only' || isUnaccounted) return UNAUTHORED_THEME.accent;
  if (label === 'Due Soon') return '#F59E0B';
  if (label === 'Completed') return '#10B981';
  if (label === 'Bidding') return Colors.secondary;
  return Colors.secondary;
}

// ─── Chit Card ────────────────────────────────────────────────
function ChitCard({ item }: { item: ActiveChit }) {
  const router = useRouter();
  const group = item.chit_group;
  const progress = item.current_month / group.duration_months;
  const pct = Math.round(progress * 100);
  const isUnaccounted = isUnaccountedGroup(item);
  const statusLabel = getStatusLabel(item);
  const statusColor = getStatusColor(statusLabel, isUnaccounted);
  const isDue = statusLabel === 'Due Soon';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isUnaccounted && styles.cardUnaccounted,
      ]}
      activeOpacity={0.88}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(tabs)/chit/${item.membership_id}`);
      }}
    >
      {/* Status Badge */}
      <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
        <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      {isUnaccounted && (
        <View style={styles.cashBadge}>
          <Text style={styles.cashBadgeText}>💵 Cash</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardCategory} numberOfLines={1}>{group.name.toUpperCase()}</Text>
        <Text style={styles.cardName} numberOfLines={1}>{group.name}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>
            {formatPaise(group.monthly_installment * item.current_month)}
            <Text style={styles.progressTotal}>/{formatPaise(group.value)}</Text>
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: statusColor }]} />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Month {item.current_month} of {group.duration_months}</Text>
          <Text style={[styles.progressLabel, { color: statusColor, fontFamily: 'Inter_700Bold' }]}>{pct}% Complete</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.footerLabel}>NEXT INSTALLMENT</Text>
          <Text style={styles.footerAmt}>
            {item.next_payment ? formatPaise(item.next_payment.amount) : 'Paid up'}
          </Text>
        </View>
        {/* Hide Pay Now button for unaccounted groups */}
        {!isUnaccounted && isDue ? (
          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/(tabs)/chit/${item.membership_id}`);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.payNowText}>Pay Now</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill={Colors.primary}>
              <Path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
            </Svg>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(tabs)/chit/${item.membership_id}`);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.detailText}>Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[styles.card, { gap: 14 }]}>
      <View style={{ width: 80, height: 22, backgroundColor: '#E2E8F0', borderRadius: 100 }} />
      <View style={{ gap: 6 }}>
        <View style={{ width: 120, height: 10, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
        <View style={{ width: 180, height: 18, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ width: '100%', height: 6, backgroundColor: '#E2E8F0', borderRadius: 100 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: 100, height: 10, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
          <View style={{ width: 60, height: 10, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function ChitsScreen() {
  const router = useRouter();
  const { memberId } = useMemberSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data: chits, isLoading, refetch } = useActiveChits(memberId);

  useEffect(() => {
    if (!memberId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['active-chits', memberId] });
    };

    const channel = supabase
      .channel('member-chits-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members', filter: `customer_id=eq.${memberId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedules' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_groups' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId, queryClient]);

  const filtered = useMemo(() => {
    if (!chits) return [];
    let list = chits;

    // Filter by status
    if (filter === 'active') list = list.filter(c => c.bid_status === 'active' && !isDueSoon(c));
    else if (filter === 'due_soon') list = list.filter(isDueSoon);
    else if (filter === 'completed') list = list.filter(c => c.bid_status === 'completed');

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.chit_group.name.toLowerCase().includes(q));
    }

    return list;
  }, [chits, filter, search]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>My Chits</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/(tabs)/join');
        }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8" style={styles.searchIcon}>
            <Path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder="Search your chit groups..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Card List */}
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>
              {search ? 'No results found' : 'No chits here'}
            </Text>
            <Text style={styles.emptySub}>
              {search ? 'Try a different search term' : 'Join a chit group to get started.'}
            </Text>
          </View>
        ) : (
          filtered.map(chit => <ChitCard key={chit.membership_id} item={chit} />)
        )}

        {/* Add New Chit Card */}
        <TouchableOpacity
          style={styles.newChitCard}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/join'); }}
          activeOpacity={0.85}
        >
          <View style={styles.newChitIconContainer}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill={Colors.secondary}>
              <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </Svg>
          </View>
          <Text style={styles.newChitTitle}>Start a New Chit</Text>
          <Text style={styles.newChitSub}>Join a group and start saving today</Text>
          <View style={styles.newChitBtn}>
            <Text style={styles.newChitBtnText}>Explore Chits</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: {
    height: 64, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)',
    ...Shadows.subtle,
  },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: Colors.primary, letterSpacing: -0.5 },
  addBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#E2E8F0', height: 52, ...Shadows.subtle,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#0B1C30',
  },
  filterRow: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 14,
    borderWidth: 1, borderColor: '#F1F5F9', position: 'relative', overflow: 'hidden',
    ...Shadows.subtle,
  },
  cardUnaccounted: {
    backgroundColor: UNAUTHORED_THEME.bg,
    borderColor: UNAUTHORED_THEME.border,
    borderWidth: 2,
  },
  badge: {
    position: 'absolute', top: 14, right: 14,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  cashBadge: {
    position: 'absolute',
    top: 48,
    right: 14,
    backgroundColor: UNAUTHORED_THEME.badgeBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  cashBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardHeader: { gap: 2, paddingRight: 80 },
  cardCategory: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: Colors.primary, letterSpacing: 1.5 },
  cardName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30', letterSpacing: -0.3 },

  progressSection: { gap: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6F787E' },
  progressValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: Colors.primary },
  progressTotal: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC',
  },
  footerLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  footerAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30', marginTop: 2 },
  payNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.secondary, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
  },
  payNowText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: Colors.primary },
  detailBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  detailText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.primary },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  // New chit card
  newChitCard: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, padding: 24,
    borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed',
    alignItems: 'center', gap: 8,
  },
  newChitIconContainer: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9',
    ...Shadows.subtle,
  },
  newChitTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.primary },
  newChitSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6F787E', textAlign: 'center' },
  newChitBtn: {
    marginTop: 4, backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12,
  },
  newChitBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFFFFF' },
});
