import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking, Modal, TextInput,
  KeyboardAvoidingView, SectionList, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../lib/supabase';
import { Colors, Shadows } from '../../../lib/constants';
import { formatPaise } from '../../../lib/hooks/useDashboard';
import { apiPostAdmin } from '../../../lib/api';
import { useAdminParentBack } from '../../../lib/hooks/admin/useAdminParentBack';

type Priority = 'high' | 'medium' | 'low';
type Status = 'pending' | 'contacted' | 'promised' | 'collected' | 'no_response';
type QueueFilter = 'open' | 'high' | 'promised' | 'unassigned' | 'no_response' | 'collected' | 'all';

type FollowupRow = {
  id: string;
  chit_member_id: string;
  payment_schedule_id: string;
  assigned_staff_id: string | null;
  priority: Priority;
  days_overdue: number;
  amount_due: number;
  suggested_action: string;
  status: Status;
  chit_members: {
    customer_id: string;
    customers: { full_name: string; phone: string } | null;
    chit_groups: { id: string; name: string } | null;
  } | null;
};

type StaffMember = { id: string; full_name: string; phone: string; active: boolean };

const STATUS_META: Record<Status, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#94A3B8' },
  contacted: { label: 'Contacted', color: '#0EA5E9' },
  promised: { label: 'Promised', color: '#F59E0B' },
  collected: { label: 'Collected', color: '#16A34A' },
  no_response: { label: 'No Response', color: '#EF4444' },
};

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: '#B91C1C', bg: '#FEE2E2' },
  medium: { label: 'Medium', color: '#B45309', bg: '#FEF3C7' },
  low: { label: 'Low', color: '#16A34A', bg: '#DCFCE7' },
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function useTodaysFollowups() {
  return useQuery<FollowupRow[]>({
    queryKey: ['admin', 'collection-followups', todayStr()],
    queryFn: async () => {
      const result: FollowupRow[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('collection_followups')
        .select(`
          id, chit_member_id, payment_schedule_id, assigned_staff_id, priority,
          days_overdue, amount_due, suggested_action, status,
          chit_members ( customer_id, customers ( full_name, phone ), chit_groups ( id, name ) )
        `)
        .eq('follow_up_date', todayStr())
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as unknown as FollowupRow[];
      result.push(...page);
      if (page.length < pageSize) return result;
      }
    },
  });
}

function useStaffMembers() {
  return useQuery<StaffMember[]>({
    queryKey: ['admin', 'staff-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, full_name, phone, active')
        .eq('active', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StaffMember[];
    },
  });
}

// ── Derived analytics ──────────────────────────────────────────

type GroupBucket = {
  groupId: string;
  groupName: string;
  rows: FollowupRow[];
  totalDue: number;
  pendingCount: number;
  completedCount: number;
  highCount: number;
};

function useAnalytics(rows: FollowupRow[]) {
  return useMemo(() => {
    const statusCounts: Record<Status, number> = {
      pending: 0, contacted: 0, promised: 0, collected: 0, no_response: 0,
    };
    const priorityCounts: Record<Priority, number> = { high: 0, medium: 0, low: 0 };
    let totalDue = 0;
    let outstandingDue = 0;

    const groupsMap = new Map<string, GroupBucket>();

    for (const r of rows) {
      statusCounts[r.status] += 1;
      priorityCounts[r.priority] += 1;
      totalDue += r.amount_due;
      const isOpen = r.status !== 'collected';
      if (isOpen) outstandingDue += r.amount_due;

      const group = r.chit_members?.chit_groups;
      const gid = group?.id ?? 'unassigned';
      const gname = group?.name ?? 'Unassigned';
      if (!groupsMap.has(gid)) {
        groupsMap.set(gid, {
          groupId: gid, groupName: gname, rows: [], totalDue: 0, pendingCount: 0, completedCount: 0, highCount: 0,
        });
      }
      const bucket = groupsMap.get(gid)!;
      bucket.rows.push(r);
      if (isOpen) bucket.totalDue += r.amount_due;
      if (r.status === 'pending') bucket.pendingCount += 1;
      if (r.status === 'collected') bucket.completedCount += 1;
      if (r.priority === 'high' && isOpen) bucket.highCount += 1;
    }

    const groups = Array.from(groupsMap.values()).sort((a, b) => {
      // Groups needing the most attention float to the top.
      if (b.highCount !== a.highCount) return b.highCount - a.highCount;
      return b.pendingCount - a.pendingCount;
    });

    const total = rows.length;
    const completed = statusCounts.collected;
    const completionRate = total > 0 ? completed / total : 0;

    return { statusCounts, priorityCounts, totalDue, outstandingDue, groups, total, completed, completionRate };
  }, [rows]);
}

function QueueSummary({
  analytics,
  unassignedCount,
}: {
  analytics: ReturnType<typeof useAnalytics>;
  unassignedCount: number;
}) {
  const activeCount = analytics.total - analytics.completed;
  const completionText = analytics.total > 0
    ? `${Math.round(analytics.completionRate * 100)}% complete`
    : 'No queue yet';
  const metrics = [
    { label: 'ACTIVE', value: String(activeCount), helper: completionText, tone: '#005E7D' },
    { label: 'OUTSTANDING', value: formatPaise(analytics.outstandingDue), helper: 'Actionable balance', tone: '#B91C1C' },
    { label: 'HIGH PRIORITY', value: String(analytics.groups.reduce((sum, group) => sum + group.highCount, 0)), helper: 'Needs attention', tone: '#B45309' },
    { label: 'UNASSIGNED', value: String(unassignedCount), helper: 'Allocate staff', tone: '#475569' },
  ];

  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0 }}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.summaryStrip}
    >
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{metric.label}</Text>
          <Text
            style={[styles.summaryValue, { color: metric.tone }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {metric.value}
          </Text>
          <Text style={styles.summaryHelper} numberOfLines={1}>{metric.helper}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Screen ──────────────────────────────────────────────────────

export default function CollectionsFollowupsScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const handleBack = useAdminParentBack(groupId ? '/(admin)/collections/followups' : '/(admin)/dashboard');
  const qc = useQueryClient();
  const { data: rows, isLoading, isError, error, refetch, isRefetching } = useTodaysFollowups();
  const { data: staff } = useStaffMembers();
  const [filter, setFilter] = useState<QueueFilter>('open');
  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [sort, setSort] = useState<'priority' | 'amount' | 'overdue' | 'name'>('priority');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [assignTarget, setAssignTarget] = useState<FollowupRow | null>(null);

  const allRows = useMemo(() => (rows ?? []).filter(row => !groupId || (row.chit_members?.chit_groups?.id ?? 'unassigned') === groupId), [rows, groupId]);
  const analytics = useAnalytics(allRows);
  const groupName = analytics.groups[0]?.groupName ?? 'Group follow-ups';

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return analytics.groups
      .map((g) => {
        let visible = g.rows;
        if (filter === 'open') {
          visible = visible.filter((r) => r.status !== 'collected');
        }
        if (filter === 'high') {
          visible = visible.filter((r) => r.priority === 'high' && r.status !== 'collected');
        }
        if (filter === 'promised') visible = visible.filter((r) => r.status === 'promised');
        if (filter === 'no_response' || filter === 'collected') visible = visible.filter(r => r.status === filter);
        if (staffFilter !== 'all') visible = visible.filter(r => r.assigned_staff_id === staffFilter);
        if (filter === 'unassigned') {
          visible = visible.filter((r) => !r.assigned_staff_id && r.status !== 'collected');
        }
        if (q) {
          const digits = q.replace(/\D/g, '');
          visible = visible.filter((r) => {
            const customer = r.chit_members?.customers;
            return (!groupId && g.groupName.toLowerCase().includes(q)) || (customer?.full_name ?? '').toLowerCase().includes(q)
              || (digits.length > 0 && (customer?.phone ?? '').replace(/\D/g, '').includes(digits));
          });
        }
        const rank = { high: 0, medium: 1, low: 2 };
        visible = [...visible].sort((a, b) => sort === 'amount' ? b.amount_due - a.amount_due
          : sort === 'overdue' ? b.days_overdue - a.days_overdue
          : sort === 'name' ? (a.chit_members?.customers?.full_name ?? '').localeCompare(b.chit_members?.customers?.full_name ?? '')
          : rank[a.priority] - rank[b.priority] || b.days_overdue - a.days_overdue);
        // Split so staff scan urgent cases first without hunting through the
        // rest — a separate section per group, not just a badge.
        const highRows = visible.filter((r) => r.priority === 'high');
        const otherRows = visible.filter((r) => r.priority !== 'high');
        return { ...g, visibleRows: visible, highRows, otherRows };
      })
      .filter((g) => g.visibleRows.length > 0);
  }, [analytics.groups, filter, search, staffFilter, sort, groupId]);

  const unassignedCount = useMemo(
    () => allRows.filter((row) => !row.assigned_staff_id && row.status !== 'collected').length,
    [allRows],
  );

  const filterOptions = useMemo(() => ([
    {
      key: 'open' as const,
      label: 'Open',
      count: allRows.filter((row) => row.status !== 'collected').length,
    },
    {
      key: 'high' as const,
      label: 'High priority',
      count: allRows.filter((row) => row.priority === 'high' && row.status !== 'collected').length,
    },
    {
      key: 'promised' as const,
      label: 'Promised',
      count: analytics.statusCounts.promised,
    },
    { key: 'unassigned' as const, label: 'Unassigned', count: unassignedCount },
    { key: 'no_response' as const, label: 'No response', count: analytics.statusCounts.no_response },
    { key: 'collected' as const, label: 'Collected', count: analytics.statusCounts.collected },
    { key: 'all' as const, label: 'All', count: analytics.total },
  ]), [allRows, analytics.statusCounts, analytics.total, unassignedCount]);

  const sections = useMemo(
    () => filteredGroups.map((group) => ({
      ...group,
      data: groupId ? group.visibleRows : [],
    })),
    [groupId, filteredGroups],
  );

  const visibleCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.visibleRows.length, 0),
    [filteredGroups],
  );

  const updateFollowup = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<Pick<FollowupRow, 'status' | 'assigned_staff_id'>> }) => {
      const { error } = await supabase.from('collection_followups').update(vars.patch).eq('id', vars.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'collection-followups'] }),
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiPostAdmin('/api/collections/followups/generate', {});
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not generate today’s list.');
    } finally {
      setGenerating(false);
    }
  };

  const handleNotifyStaff = async () => {
    try {
      await apiPostAdmin('/api/collections/followups/resend-digest', {});
      Alert.alert('Staff notified', 'Today\'s follow-up list was sent to assigned staff.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not notify assigned staff.');
    }
  };

  const markCollected = (row: FollowupRow) => {
    Alert.alert(
      'Mark Collected',
      'This only logs that staff reported the payment as collected. It does NOT record the actual payment. ' +
      'You still need to record it via the customer’s payment/cash-collection screen for it to count toward dues.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go Record Payment', onPress: () => {
            updateFollowup.mutate({ id: row.id, patch: { status: 'collected' } });
            if (row.chit_members?.customer_id) {
              router.push(`/(admin)/customers/${row.chit_members.customer_id}`);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); handleBack(); }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={groupId ? 'Back to collection groups' : 'Back to dashboard'}
        >
          <Text style={{ fontSize: 20, color: Colors.primary }}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.appBarTitle, { flex: 1 }]} numberOfLines={1}>{groupId ? groupName : 'Collections Follow-ups'}</Text>
        <TouchableOpacity
          onPress={() => setStaffModalVisible(true)}
          style={styles.staffHeaderBtn}
          accessibilityRole="button"
          accessibilityLabel="Manage collection staff"
        >
          <Text style={styles.staffHeaderBtnText}>Staff</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading today’s collection queue…</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Couldn’t load follow-ups</Text>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Please check your connection and try again.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          key={groupId ?? 'groups'}
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Android can incorrectly clip section rows that sit below a tall,
          // dynamic ListHeaderComponent. Keep virtualization, but disable the
          // clipping optimization so a populated queue never renders blank.
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={false}
          refreshControl={(
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          )}
          ListHeaderComponent={(
            <View>
              {!groupId && <View style={styles.operationsCard}>
                <View style={styles.operationsCopy}>
                  <Text style={styles.operationsEyebrow}>TODAY’S WORKLIST</Text>
                  <Text style={styles.operationsTitle}>Collections by group</Text>
                  <Text style={styles.operationsSub}>Choose a group to review customers and manage follow-ups.</Text>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerate} disabled={generating}>
                    {generating
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.primaryBtnText}>Refresh queue</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handleNotifyStaff}
                    accessibilityRole="button"
                    accessibilityLabel="Notify assigned staff about today's follow-ups"
                  >
                    <Text style={styles.secondaryBtnText}>Notify staff</Text>
                  </TouchableOpacity>
                </View>
              </View>}

              <QueueSummary analytics={analytics} unassignedCount={unassignedCount} />

              <View style={styles.queueHeadingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueTitle}>{groupId ? 'Customer follow-ups' : 'Chit groups'}</Text>
                  <Text style={styles.queueSubtitle}>{groupId ? `${new Set(filteredGroups.flatMap(g => g.visibleRows.map(r => r.chit_members?.customer_id ?? r.chit_member_id))).size} customers · ${visibleCount} follow-ups` : `${filteredGroups.length} groups with matching follow-ups`}</Text>
                </View>
                {(search || staffFilter !== 'all' || filter !== 'open' || sort !== 'priority') && (
                  <TouchableOpacity
                    style={styles.collapseToggle}
                    onPress={() => { setSearch(''); setStaffFilter('all'); setFilter('open'); setSort('priority'); }}
                  >
                    <Text style={styles.collapseToggleText}>Reset filters</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.fieldLabel}>{groupId ? 'Find a customer' : 'Find a group or customer'}</Text>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>{'⌕'}</Text>
                <TextInput
                  style={styles.searchInput}
                  accessibilityLabel={groupId ? 'Search customers' : 'Search groups or customers'}
                  placeholder={groupId ? 'Enter name or mobile number' : 'Enter group or customer name'}
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                    <Text style={styles.searchClear}>{'✕'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.fieldLabel}>Follow-up status · counts are follow-ups</Text>
              <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {filterOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === option.key }}
                    style={[styles.chip, filter === option.key && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setFilter(option.key); }}
                  >
                    <Text style={[styles.chipText, filter === option.key && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                    <View style={[styles.chipCount, filter === option.key && styles.chipCountActive]}>
                      <Text style={[styles.chipCountText, filter === option.key && styles.chipCountTextActive]}>{option.count}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {groupId && <TouchableOpacity style={styles.advancedToggle} accessibilityRole="button" accessibilityState={{ expanded: showAdvancedFilters }} onPress={() => setShowAdvancedFilters(value => !value)}>
                <Text style={styles.collapseToggleText}>{showAdvancedFilters ? 'Hide staff & sorting' : 'Staff & sorting'}{staffFilter !== 'all' || sort !== 'priority' ? ' · Applied' : ''} {showAdvancedFilters ? '−' : '+'}</Text>
              </TouchableOpacity>}
              {groupId && showAdvancedFilters && <>
                <Text style={styles.fieldLabel}>Assigned staff</Text>
                <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {[{ id: 'all', full_name: 'All staff' }, ...(staff ?? [])].map(person => (
                    <TouchableOpacity key={person.id} accessibilityRole="button" accessibilityState={{ selected: staffFilter === person.id }}
                      style={[styles.chip, staffFilter === person.id && styles.chipActive]} onPress={() => setStaffFilter(person.id)}>
                      <Text style={[styles.chipText, staffFilter === person.id && styles.chipTextActive]}>{person.full_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.fieldLabel}>Sort follow-ups</Text>
                <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {([{ key: 'priority', label: 'Priority' }, { key: 'amount', label: 'Highest due' }, { key: 'overdue', label: 'Most overdue' }, { key: 'name', label: 'Customer A–Z' }] as const).map(option => (
                    <TouchableOpacity key={option.key} accessibilityRole="button" accessibilityState={{ selected: sort === option.key }}
                      style={[styles.chip, sort === option.key && styles.chipActive]} onPress={() => setSort(option.key)}>
                      <Text style={[styles.chipText, sort === option.key && styles.chipTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>}
            </View>
          )}
          renderSectionHeader={({ section }) => {
            if (groupId) return null;
            return (
              <TouchableOpacity
                style={[styles.groupHeader, styles.groupEntry]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${section.groupName} follow-ups`}
                onPress={() => router.push({ pathname: '/(admin)/collections/group', params: { groupId: section.groupId } })}
                activeOpacity={0.85}
              >
                <View style={styles.groupAccent} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.groupHeaderTitleRow}>
                    <Text style={styles.groupHeaderName} numberOfLines={2}>{section.groupName}</Text>
                    {section.highRows.length > 0 && (
                      <View style={styles.groupHeaderHighBadge}>
                        <Text style={styles.groupHeaderHighBadgeText}>{section.highRows.length} high</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.groupHeaderMeta} numberOfLines={1}>
                    {new Set(section.rows.map(r => r.chit_members?.customer_id ?? r.chit_member_id)).size} customers · {section.rows.length} follow-ups
                  </Text>
                  <Text style={styles.groupDue}>{formatPaise(section.totalDue)} outstanding</Text>
                  <Text style={styles.groupHeaderMeta}>{section.visibleRows.length} match filters · View customers →</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          }}
          renderItem={({ item }) => (
            <FollowupCard
              row={item}
              staff={staff ?? []}
              onOpenCustomer={() => {
                const customerId = item.chit_members?.customer_id;
                if (customerId) router.push(`/(admin)/customers/${customerId}`);
              }}
              onUpdate={(patch) => updateFollowup.mutate({ id: item.id, patch })}
              onMarkCollected={() => markCollected(item)}
              onAssignPress={() => setAssignTarget(item)}
            />
          )}
          ListEmptyComponent={filteredGroups.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✓</Text></View>
              <Text style={styles.emptyTitle}>{analytics.total === 0 ? 'No follow-ups available' : 'No matching follow-ups'}</Text>
              <Text style={styles.emptySub}>
                {analytics.total === 0
                  ? 'Return to the group list and refresh the queue to check for unpaid completed-auction dues.'
                  : 'Try another filter or clear the search.'}
              </Text>
            </View>
          ) : null}
          ListFooterComponent={<View style={{ height: 88 }} />}
        />
      )}

      <StaffManagerModal visible={staffModalVisible} onClose={() => setStaffModalVisible(false)} staff={staff ?? []} />
      <AssignStaffModal
        row={assignTarget}
        staff={staff ?? []}
        onClose={() => setAssignTarget(null)}
        onAssign={(staffId) => {
          if (assignTarget) updateFollowup.mutate({ id: assignTarget.id, patch: { assigned_staff_id: staffId } });
          setAssignTarget(null);
        }}
        onOpenManageStaff={() => { setAssignTarget(null); setStaffModalVisible(true); }}
      />
    </SafeAreaView>
  );
}

function FollowupCard({
  row, staff, onOpenCustomer, onUpdate, onMarkCollected, onAssignPress,
}: {
  row: FollowupRow;
  staff: StaffMember[];
  onOpenCustomer: () => void;
  onUpdate: (patch: Partial<Pick<FollowupRow, 'status' | 'assigned_staff_id'>>) => void;
  onMarkCollected: () => void;
  onAssignPress: () => void;
}) {
  const cust = row.chit_members?.customers;
  const pc = PRIORITY_META[row.priority];
  const statusMeta = STATUS_META[row.status];
  const assignedStaff = staff.find((s) => s.id === row.assigned_staff_id);
  const initials = (cust?.full_name ?? 'Customer')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const openStatusMenu = () => {
    Alert.alert(
      'Update follow-up status',
      `Choose the latest outcome for ${cust?.full_name ?? 'this customer'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'No response', onPress: () => onUpdate({ status: 'no_response' }) },
        { text: 'Promised to pay', onPress: () => onUpdate({ status: 'promised' }) },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <TouchableOpacity style={styles.customerIdentity} onPress={onOpenCustomer} activeOpacity={0.75}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>{initials || 'C'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.custName} numberOfLines={1}>{cust?.full_name ?? 'Customer'}</Text>
            <Text style={styles.customerPhone} numberOfLines={1}>{cust?.phone ?? 'Mobile number unavailable'}</Text>
          </View>
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: pc.bg }]}>
          <Text style={[styles.badgeText, { color: pc.color }]}>{pc.label}</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>AMOUNT DUE</Text>
          <Text style={styles.amountValue}>{formatPaise(row.amount_due)}</Text>
        </View>
        <View style={styles.overdueBlock}>
          <Text style={styles.overdueValue}>{Math.abs(row.days_overdue)}</Text>
          <Text style={styles.overdueLabel}>{row.days_overdue < 0 ? 'days until due' : row.days_overdue === 0 ? 'due today' : 'days overdue'}</Text>
        </View>
      </View>

      {row.suggested_action ? (
        <Text style={styles.suggestion} numberOfLines={2}>{row.suggested_action}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <TouchableOpacity style={[styles.statusPill, { borderColor: statusMeta.color }]} onPress={openStatusMenu}>
          <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
          <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label} ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.assignBtn} onPress={onAssignPress}>
          <Text style={styles.assignBtnText} numberOfLines={1}>
            {assignedStaff ? assignedStaff.full_name : 'Assign staff'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          onPress={() => cust?.phone && Linking.openURL(`tel:${cust.phone}`)}
          style={[styles.cardActionBtn, !cust?.phone && styles.cardActionDisabled]}
          disabled={!cust?.phone}
        >
          <Text style={styles.cardActionText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cardActionBtn, row.status === 'contacted' && styles.cardActionSelected]}
          onPress={() => onUpdate({ status: 'contacted' })}
          disabled={row.status === 'contacted'}
        >
          <Text style={[styles.cardActionText, row.status === 'contacted' && styles.cardActionSelectedText]}>
            {row.status === 'contacted' ? 'Contacted' : 'Mark contacted'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.paymentBtn} onPress={onMarkCollected}>
          <Text style={styles.paymentBtnText}>Record payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StaffManagerModal({ visible, onClose, staff }: { visible: boolean; onClose: () => void; staff: StaffMember[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const addStaff = useMutation({
    mutationFn: async () => {
      const normalizedPhone = phone.replace(/\D/g, '');
      if (!name.trim() || !normalizedPhone) throw new Error('Name and phone are required.');
      if (!/^\d{10}$/.test(normalizedPhone)) throw new Error('Phone must contain exactly 10 digits.');
      const { error } = await supabase.from('staff_members').insert({ full_name: name.trim(), phone: normalizedPhone });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setName(''); setPhone('');
      qc.invalidateQueries({ queryKey: ['admin', 'staff-members'] });
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const deactivateStaff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_members').update({ active: false }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'staff-members'] }),
  });

  const canSave = name.trim().length > 0 && /^\d{10}$/.test(phone.replace(/\D/g, '')) && !addStaff.isPending;

  const requestClose = () => {
    if (!name.trim() && !phone.trim()) {
      onClose();
      return;
    }
    Alert.alert(
      'Discard staff details?',
      'You have unsaved changes. Close and discard them?',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { setName(''); setPhone(''); onClose(); } },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={requestClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Manage Staff</Text>

          {/* Pinned at the top so it's always reachable and typable, no
              matter how many staff are already in the list below. */}
          <View style={styles.staffForm}>
            <Text style={styles.staffFormLabel}>Add new staff</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter staff member name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit mobile number"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={(value) => setPhone(value.replace(/\D/g, ''))}
              keyboardType="phone-pad"
              returnKeyType="done"
              maxLength={10}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
              onPress={() => addStaff.mutate()}
              disabled={!canSave}
            >
              {addStaff.isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Save Staff Member</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.staffListHeader}>
            <Text style={styles.staffFormLabel}>Current staff ({staff.length})</Text>
          </View>
          <ScrollView style={styles.staffListScroll} keyboardShouldPersistTaps="handled">
            {staff.length === 0 ? (
              <Text style={styles.staffEmptyText}>No staff added yet — add one above.</Text>
            ) : (
              staff.map((s) => (
                <View key={s.id} style={styles.staffRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.staffName}>{s.full_name}</Text>
                    <Text style={styles.staffPhone}>{s.phone}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deactivateStaff.mutate(s.id)} hitSlop={8}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.secondaryBtn} onPress={requestClose}>
            <Text style={styles.secondaryBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AssignStaffModal({
  row, staff, onClose, onAssign, onOpenManageStaff,
}: {
  row: FollowupRow | null;
  staff: StaffMember[];
  onClose: () => void;
  onAssign: (staffId: string | null) => void;
  onOpenManageStaff: () => void;
}) {
  const custName = row?.chit_members?.customers?.full_name ?? 'this customer';

  return (
    <Modal visible={!!row} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Assign staff</Text>
          <Text style={styles.assignModalSub} numberOfLines={1}>For follow-up with {custName}</Text>

          {staff.length === 0 ? (
            <View style={{ paddingVertical: 20, gap: 10 }}>
              <Text style={styles.staffEmptyText}>No staff added yet.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onOpenManageStaff}>
                <Text style={styles.primaryBtnText}>Add Staff</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.staffListScroll}>
              {row?.assigned_staff_id && (
                <TouchableOpacity style={styles.assignOptionRow} onPress={() => onAssign(null)}>
                  <Text style={styles.assignOptionUnassign}>Unassign</Text>
                </TouchableOpacity>
              )}
              {staff.map((s) => {
                const selected = row?.assigned_staff_id === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.assignOptionRow, selected && styles.assignOptionRowSelected]}
                    onPress={() => onAssign(s.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{s.full_name}</Text>
                      <Text style={styles.staffPhone}>{s.phone}</Text>
                    </View>
                    {selected && <Text style={styles.assignOptionCheck}>{'✓'}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },
  staffHeaderBtn: { height: 36, minWidth: 54, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5FA' },
  staffHeaderBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary },
  listContent: { paddingBottom: 20 },
  advancedToggle: { alignSelf: 'flex-start', marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: '#E8F5FA' },
  fieldLabel: { marginHorizontal: 16, marginBottom: 6, fontSize: 12, fontWeight: '600', color: '#526477' },
  groupEntry: { backgroundColor: '#FFFFFF', paddingVertical: 20, marginBottom: 12, borderRadius: 16, ...Shadows.subtle },
  groupDue: { fontSize: 18, fontWeight: '700', color: Colors.primary, marginVertical: 8 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#64748B' },
  errorState: { margin: 20, padding: 24, borderRadius: 18, alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FECACA', gap: 8 },
  errorTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: '#991B1B' },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: '#64748B', textAlign: 'center' },
  retryBtn: { marginTop: 6, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 13 },

  operationsCard: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: '#EAF7FB', borderWidth: 1, borderColor: '#D3EDF5' },
  operationsCopy: { marginBottom: 14 },
  operationsEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#007A8A', letterSpacing: 1.1, marginBottom: 5 },
  operationsTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 19, color: '#0B1C30' },
  operationsSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18, color: '#526477', marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 13 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: Colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#FFF' },
  secondaryBtnText: { fontFamily: 'Inter_600SemiBold', color: Colors.primary, fontSize: 13 },

  summaryStrip: { gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  summaryCard: { width: 136, minHeight: 88, padding: 13, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7EDF3', ...Shadows.subtle },
  summaryLabel: { fontFamily: 'Inter_700Bold', fontSize: 8.5, letterSpacing: 0.8, color: '#7A899A' },
  summaryValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 21, marginTop: 5 },
  summaryHelper: { fontFamily: 'Inter_400Regular', fontSize: 10.5, color: '#8390A0', marginTop: 2 },
  queueHeadingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  queueTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  queueSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#7A899A', marginTop: 2 },
  collapseToggle: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: '#E8F5FA' },
  collapseToggleText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.primary },
  searchBox: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8E2EA', borderRadius: 13, paddingHorizontal: 13, height: 46 },
  searchIcon: { fontSize: 20, color: '#64748B', transform: [{ rotate: '-20deg' }] },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#0B1C30', height: '100%' },
  searchClear: { fontSize: 13, color: '#94A3B8', paddingHorizontal: 2 },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  chipCount: { minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F6' },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  chipCountText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#526477' },
  chipCountTextActive: { color: '#FFF' },

  empty: { alignItems: 'center', paddingVertical: 58, paddingHorizontal: 28, gap: 6 },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIconText: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#16A34A' },
  emptyTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: '#94A3B8', textAlign: 'center' },

  // Virtualized group section headers
  groupHeader: { marginHorizontal: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#EFF7FA', borderWidth: 1, borderColor: '#DCECF2' },
  groupAccent: { width: 4, height: 34, borderRadius: 2, backgroundColor: Colors.primary },
  groupHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupHeaderName: { flex: 1, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14.5, color: '#0B1C30' },
  groupHeaderHighBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100, backgroundColor: '#FEE2E2' },
  groupHeaderHighBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#B91C1C' },
  groupHeaderMeta: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B', marginTop: 2 },
  chevron: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', textAlign: 'center', lineHeight: 25, fontSize: 16, color: Colors.primary, overflow: 'hidden' },

  card: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#FFF', borderRadius: 16, padding: 14, gap: 11, borderWidth: 1, borderColor: '#E8EDF2', ...Shadows.subtle },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
  customerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF3F8' },
  customerAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: Colors.primary },
  custName: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14.5, color: '#0B1C30', flex: 1 },
  customerPhone: { fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#7A899A', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 9.5, textTransform: 'uppercase' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 2 },
  amountLabel: { fontFamily: 'Inter_700Bold', fontSize: 8.5, letterSpacing: 0.7, color: '#94A3B8' },
  amountValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 21, color: '#0B1C30', marginTop: 2 },
  overdueBlock: { alignItems: 'flex-end' },
  overdueValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: '#B91C1C' },
  overdueLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#94A3B8' },
  suggestion: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#526477', lineHeight: 17, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderRadius: 100, backgroundColor: '#FFF' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  assignBtn: { flex: 1, minWidth: 0, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#EEF7FA', borderRadius: 8, alignItems: 'flex-end' },
  assignBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: Colors.primary },
  cardActions: { flexDirection: 'row', gap: 7, paddingTop: 2 },
  cardActionBtn: { minHeight: 36, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: '#D8E2EA', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  cardActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5, color: '#334155' },
  cardActionSelected: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  cardActionSelectedText: { color: '#15803D' },
  cardActionDisabled: { opacity: 0.4 },
  paymentBtn: { flex: 1, minHeight: 36, paddingHorizontal: 10, borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  paymentBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5, color: '#FFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12, maxHeight: '85%' },
  modalTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  staffFormLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 },
  staffForm: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#0B1C30' },
  primaryBtnDisabled: { opacity: 0.45 },
  staffListHeader: { paddingTop: 4 },
  staffListScroll: { maxHeight: 220 },
  staffEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', paddingVertical: 10 },
  staffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  staffName: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: '#0B1C30' },
  staffPhone: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 1 },
  removeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#B91C1C' },
  assignModalSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#64748B', marginTop: -6 },
  assignOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  assignOptionRowSelected: { backgroundColor: 'rgba(1,120,158,0.06)', borderRadius: 10 },
  assignOptionUnassign: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#B91C1C', paddingVertical: 2 },
  assignOptionCheck: { fontFamily: 'Inter_700Bold', fontSize: 15, color: Colors.primary },
});
