import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking, Modal, TextInput,
  LayoutAnimation, Platform, UIManager, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G } from 'react-native-svg';
import { supabase } from '../../../lib/supabase';
import { Colors, Shadows } from '../../../lib/constants';
import { formatPaise } from '../../../lib/hooks/useDashboard';
import { apiPostAdmin } from '../../../lib/api';
import { useAdminParentBack } from '../../../lib/hooks/admin/useAdminParentBack';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Priority = 'high' | 'medium' | 'low';
type Status = 'pending' | 'contacted' | 'promised' | 'collected' | 'no_response';

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

function animate() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function useTodaysFollowups() {
  return useQuery<FollowupRow[]>({
    queryKey: ['admin', 'collection-followups', todayStr()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_followups')
        .select(`
          id, chit_member_id, payment_schedule_id, assigned_staff_id, priority,
          days_overdue, amount_due, suggested_action, status,
          chit_members ( customer_id, customers ( full_name, phone ), chit_groups ( id, name ) )
        `)
        .eq('follow_up_date', todayStr())
        .order('priority', { ascending: false })
        .order('days_overdue', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FollowupRow[];
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
      const isOpen = r.status !== 'collected' && r.status !== 'no_response';
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
      bucket.totalDue += r.amount_due;
      if (r.status === 'pending') bucket.pendingCount += 1;
      if (r.status === 'collected' || r.status === 'no_response') bucket.completedCount += 1;
      if (r.priority === 'high') bucket.highCount += 1;
    }

    const groups = Array.from(groupsMap.values()).sort((a, b) => {
      // Groups needing the most attention float to the top.
      if (b.highCount !== a.highCount) return b.highCount - a.highCount;
      return b.pendingCount - a.pendingCount;
    });

    const total = rows.length;
    const completed = statusCounts.collected + statusCounts.no_response;
    const completionRate = total > 0 ? completed / total : 0;

    return { statusCounts, priorityCounts, totalDue, outstandingDue, groups, total, completed, completionRate };
  }, [rows]);
}

// ── Donut chart (plain react-native-svg, no external chart lib) ──

function DonutChart({
  segments, size = 108, strokeWidth = 16,
}: { segments: { value: number; color: string }[]; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let cumulative = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${cx}, ${cy}`}>
        <Circle cx={cx} cy={cy} r={radius} stroke="#EEF2F6" strokeWidth={strokeWidth} fill="none" />
        {total > 0 && segments.filter((s) => s.value > 0).map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const dashOffset = -cumulative;
          cumulative += dash;
          return (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              fill="none"
            />
          );
        })}
      </G>
    </Svg>
  );
}

function AnalyticsOverview({ analytics }: { analytics: ReturnType<typeof useAnalytics> }) {
  const { statusCounts, priorityCounts, totalDue, outstandingDue, total, completed, completionRate, groups } = analytics;
  const pctText = `${Math.round(completionRate * 100)}%`;
  const statusSegments = (Object.keys(STATUS_META) as Status[]).map((k) => ({
    value: statusCounts[k], color: STATUS_META[k].color, key: k,
  }));
  const maxPriority = Math.max(1, priorityCounts.high, priorityCounts.medium, priorityCounts.low);

  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsTitle}>Today's Overview</Text>

      <View style={styles.statTilesRow}>
        <View style={styles.statTile}>
          <Text style={styles.statTileValue}>{total}</Text>
          <Text style={styles.statTileLabel}>Follow-ups</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statTileValue, { color: '#16A34A' }]}>{completed}</Text>
          <Text style={styles.statTileLabel}>Completed</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statTileValue, { color: '#B91C1C' }]}>{formatPaise(outstandingDue)}</Text>
          <Text style={styles.statTileLabel}>Outstanding</Text>
        </View>
      </View>

      <View style={styles.donutRow}>
        <View style={{ width: 108, height: 108 }}>
          <DonutChart segments={statusSegments} />
          <View style={styles.donutCenterLabel}>
            <Text style={styles.donutCenterPct}>{pctText}</Text>
            <Text style={styles.donutCenterSub}>done</Text>
          </View>
        </View>
        <View style={styles.legendCol}>
          {statusSegments.filter((s) => s.value > 0).map((s) => (
            <View key={s.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel}>{STATUS_META[s.key].label}</Text>
              <Text style={styles.legendValue}>{s.value}</Text>
            </View>
          ))}
          {total === 0 && <Text style={styles.legendEmpty}>No follow-ups generated yet today.</Text>}
        </View>
      </View>

      <View style={styles.priorityBlock}>
        <Text style={styles.priorityBlockTitle}>By priority</Text>
        {(['high', 'medium', 'low'] as Priority[]).map((p) => {
          const count = priorityCounts[p];
          const meta = PRIORITY_META[p];
          const width = `${Math.round((count / maxPriority) * 100)}%`;
          return (
            <View key={p} style={styles.priorityRow}>
              <Text style={styles.priorityRowLabel}>{meta.label}</Text>
              <View style={styles.priorityTrack}>
                <View style={[styles.priorityFill, { width: width as any, backgroundColor: meta.color }]} />
              </View>
              <Text style={styles.priorityRowCount}>{count}</Text>
            </View>
          );
        })}
      </View>

      {groups.length > 1 && (
        <View style={styles.groupRankBlock}>
          <Text style={styles.priorityBlockTitle}>Groups needing attention</Text>
          {groups.slice(0, 4).map((g) => (
            <View key={g.groupId} style={styles.groupRankRow}>
              <Text style={styles.groupRankName} numberOfLines={1}>{g.groupName}</Text>
              {g.highCount > 0 && (
                <View style={styles.groupRankBadge}>
                  <Text style={styles.groupRankBadgeText}>{g.highCount} high</Text>
                </View>
              )}
              <Text style={styles.groupRankDue}>{formatPaise(g.totalDue)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────

export default function CollectionsFollowupsScreen() {
  const router = useRouter();
  const handleBack = useAdminParentBack('/(admin)/dashboard');
  const qc = useQueryClient();
  const { data: rows, isLoading, refetch, isRefetching } = useTodaysFollowups();
  const { data: staff } = useStaffMembers();
  const [filter, setFilter] = useState<'all' | 'pending' | 'high'>('pending');
  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState<FollowupRow | null>(null);

  const allRows = rows ?? [];
  const analytics = useAnalytics(allRows);

  // With many groups, showing every one fully expanded is unusable — default
  // to collapsing groups with nothing urgent so staff land on what actually
  // needs attention first. Only runs once per data load, so a staff member's
  // manual expand/collapse choices aren't reset on every refetch.
  const didInitCollapse = useRef(false);
  useEffect(() => {
    if (didInitCollapse.current || analytics.groups.length === 0) return;
    didInitCollapse.current = true;
    setCollapsed(new Set(analytics.groups.filter((g) => g.highCount === 0).map((g) => g.groupId)));
  }, [analytics.groups]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return analytics.groups
      .map((g) => {
        let visible = g.rows;
        if (filter === 'pending') visible = visible.filter((r) => r.status === 'pending');
        if (filter === 'high') visible = visible.filter((r) => r.priority === 'high');
        if (q) {
          const digits = q.replace(/\D/g, '');
          visible = visible.filter((r) => {
            const customer = r.chit_members?.customers;
            return (customer?.full_name ?? '').toLowerCase().includes(q)
              || (digits.length > 0 && (customer?.phone ?? '').replace(/\D/g, '').includes(digits));
          });
        }
        // Split so staff scan urgent cases first without hunting through the
        // rest — a separate section per group, not just a badge.
        const highRows = visible.filter((r) => r.priority === 'high');
        const otherRows = visible.filter((r) => r.priority !== 'high');
        return { ...g, visibleRows: visible, highRows, otherRows };
      })
      .filter((g) => g.visibleRows.length > 0);
  }, [analytics.groups, filter, search]);

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

  const handleResendDigest = async () => {
    try {
      await apiPostAdmin('/api/collections/followups/resend-digest', {});
      Alert.alert('Sent', 'Digest re-sent to assigned staff.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not resend digest.');
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

  const toggleGroup = (groupId: string) => {
    animate();
    Haptics.selectionAsync();
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const expandAll = () => {
    animate();
    Haptics.selectionAsync();
    setCollapsed(new Set());
  };

  const collapseAll = () => {
    animate();
    Haptics.selectionAsync();
    setCollapsed(new Set(filteredGroups.map((g) => g.groupId)));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); handleBack(); }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
        >
          <Text style={{ fontSize: 20, color: Colors.primary }}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Collections Follow-ups</Text>
        <TouchableOpacity onPress={() => setStaffModalVisible(true)} style={styles.backBtn}>
          <Text style={{ fontSize: 18 }}>{'👥'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerate} disabled={generating}>
            {generating ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.primaryBtnText}>Generate Today's List</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleResendDigest}>
            <Text style={styles.secondaryBtnText}>Re-send Digest</Text>
          </TouchableOpacity>
        </View>

        {isLoading || isRefetching ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : (
          <>
            <AnalyticsOverview analytics={analytics} />

            <View style={styles.toolbarRow}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>{'🔍'}</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by customer name or mobile number"
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Text style={styles.searchClear}>{'✕'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.toolbarBtn} onPress={expandAll}>
                <Text style={styles.toolbarBtnText}>Expand all</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn} onPress={collapseAll}>
                <Text style={styles.toolbarBtnText}>Collapse all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['pending', 'high', 'all'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, filter === f && styles.chipActive]}
                  onPress={() => { Haptics.selectionAsync(); setFilter(f); }}
                >
                  <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                    {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'High Priority'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.list}>
              {filteredGroups.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Nothing to show</Text>
                  <Text style={styles.emptySub}>
                    {analytics.total === 0 ? 'Tap "Generate Today\'s List" to build today’s follow-ups from real unpaid dues.' : 'No follow-ups match this filter.'}
                  </Text>
                </View>
              ) : (
                filteredGroups.map((g) => {
                  const isCollapsed = collapsed.has(g.groupId);
                  const groupCompletion = g.rows.length > 0 ? g.completedCount / g.rows.length : 0;
                  return (
                    <View key={g.groupId} style={styles.groupSection}>
                      <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(g.groupId)} activeOpacity={0.7}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.groupHeaderTitleRow}>
                            <Text style={styles.groupHeaderName} numberOfLines={1}>{g.groupName}</Text>
                            {g.highCount > 0 && (
                              <View style={styles.groupHeaderHighBadge}>
                                <Text style={styles.groupHeaderHighBadgeText}>{g.highCount} high</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.groupHeaderMeta}>
                            {g.visibleRows.length} of {g.rows.length} shown · {formatPaise(g.totalDue)} due
                          </Text>
                          <View style={styles.groupProgressTrack}>
                            <View style={[styles.groupProgressFill, { width: `${Math.round(groupCompletion * 100)}%` }]} />
                          </View>
                        </View>
                        <Text style={styles.chevron}>{isCollapsed ? '▾' : '▴'}</Text>
                      </TouchableOpacity>

                      {!isCollapsed && (
                        <View style={styles.groupBody}>
                          {g.highRows.length > 0 && (
                            <View style={styles.sectionBlock}>
                              <View style={styles.sectionHeaderRow}>
                                <View style={styles.sectionHeaderDotHigh} />
                                <Text style={styles.sectionHeaderText}>High Priority</Text>
                                <Text style={styles.sectionHeaderCount}>{g.highRows.length}</Text>
                              </View>
                              {g.highRows.map((row) => (
                                <FollowupCard
                                  key={row.id}
                                  row={row}
                                  staff={staff ?? []}
                                  onUpdate={(patch) => updateFollowup.mutate({ id: row.id, patch })}
                                  onMarkCollected={() => markCollected(row)}
                                  onAssignPress={() => setAssignTarget(row)}
                                />
                              ))}
                            </View>
                          )}

                          {g.otherRows.length > 0 && (
                            <View style={styles.sectionBlock}>
                              <View style={styles.sectionHeaderRow}>
                                <View style={styles.sectionHeaderDotOther} />
                                <Text style={styles.sectionHeaderText}>Other Follow-ups</Text>
                                <Text style={styles.sectionHeaderCount}>{g.otherRows.length}</Text>
                              </View>
                              {g.otherRows.map((row) => (
                                <FollowupCard
                                  key={row.id}
                                  row={row}
                                  staff={staff ?? []}
                                  onUpdate={(patch) => updateFollowup.mutate({ id: row.id, patch })}
                                  onMarkCollected={() => markCollected(row)}
                                  onAssignPress={() => setAssignTarget(row)}
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

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
  row, staff, onUpdate, onMarkCollected, onAssignPress,
}: {
  row: FollowupRow;
  staff: StaffMember[];
  onUpdate: (patch: Partial<Pick<FollowupRow, 'status' | 'assigned_staff_id'>>) => void;
  onMarkCollected: () => void;
  onAssignPress: () => void;
}) {
  const cust = row.chit_members?.customers;
  const pc = PRIORITY_META[row.priority];
  const assignedStaff = staff.find((s) => s.id === row.assigned_staff_id);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.custName} numberOfLines={1}>{cust?.full_name ?? 'Customer'}</Text>
        <View style={[styles.badge, { backgroundColor: pc.bg }]}>
          <Text style={[styles.badgeText, { color: pc.color }]}>{pc.label.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.groupLine}>{formatPaise(row.amount_due)} due</Text>
      <Text style={styles.suggestion}>{row.suggested_action}</Text>

      <View style={styles.rowBetween}>
        <TouchableOpacity
          onPress={() => cust?.phone && Linking.openURL(`tel:${cust.phone}`)}
          style={styles.callBtn}
        >
          <Text style={styles.callBtnText}>{'📞'} {cust?.phone ?? '—'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.assignBtn} onPress={onAssignPress}>
          <Text style={styles.assignBtnText} numberOfLines={1}>
            {assignedStaff ? `👤 ${assignedStaff.full_name}` : 'Assign staff'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.statusLabel}>Status: {row.status.replace('_', ' ')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => onUpdate({ status: 'contacted' })}
          >
            <Text style={styles.smallBtnText}>Mark Contacted</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallBtn, styles.collectBtn]}
            onPress={onMarkCollected}
          >
            <Text style={[styles.smallBtnText, { color: '#FFF' }]}>Mark Collected</Text>
          </TouchableOpacity>
        </View>
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
  scrollBody: { paddingBottom: 20 },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  primaryBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 13 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: Colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondaryBtnText: { fontFamily: 'Inter_600SemiBold', color: Colors.primary, fontSize: 13 },

  // Analytics
  analyticsCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#FFF', borderRadius: 20, padding: 18, gap: 14, borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle },
  analyticsTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#0B1C30' },
  statTilesRow: { flexDirection: 'row', gap: 10 },
  statTile: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 2 },
  statTileValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },
  statTileLabel: { fontFamily: 'Inter_500Medium', fontSize: 10.5, color: '#64748B' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  donutCenterLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  donutCenterPct: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  donutCenterSub: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#94A3B8' },
  legendCol: { flex: 1, gap: 7 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12.5, color: '#334155' },
  legendValue: { fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#0B1C30' },
  legendEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8' },
  priorityBlock: { gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  priorityBlockTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B', marginBottom: 2 },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityRowLabel: { width: 56, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#334155' },
  priorityTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  priorityFill: { height: '100%', borderRadius: 4 },
  priorityRowCount: { width: 22, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 12, color: '#0B1C30' },
  groupRankBlock: { gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  groupRankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  groupRankName: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12.5, color: '#334155' },
  groupRankBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100, backgroundColor: '#FEE2E2' },
  groupRankBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#B91C1C' },
  groupRankDue: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#0B1C30' },

  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, height: 40 },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#0B1C30', height: '100%' },
  searchClear: { fontSize: 13, color: '#94A3B8', paddingHorizontal: 2 },
  toolbarBtn: { paddingHorizontal: 10, height: 40, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  toolbarBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#334155' },
  filterRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  chipTextActive: { color: '#FFF' },

  list: { paddingHorizontal: 20, gap: 18 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 6 },
  emptyTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 30 },

  // Group section (accordion)
  groupSection: { backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', ...Shadows.subtle },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  groupHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupHeaderName: { flex: 1, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14.5, color: '#0B1C30' },
  groupHeaderHighBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100, backgroundColor: '#FEE2E2' },
  groupHeaderHighBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#B91C1C' },
  groupHeaderMeta: { fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#64748B', marginTop: 2 },
  groupProgressTrack: { height: 5, borderRadius: 3, backgroundColor: '#EEF2F6', overflow: 'hidden', marginTop: 6 },
  groupProgressFill: { height: '100%', backgroundColor: '#16A34A', borderRadius: 3 },
  chevron: { fontSize: 14, color: '#94A3B8', paddingLeft: 4 },
  groupBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  sectionBlock: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  sectionHeaderDotHigh: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B91C1C' },
  sectionHeaderDotOther: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#94A3B8' },
  sectionHeaderText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionHeaderCount: { fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#94A3B8' },

  card: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, gap: 9, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  custName: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14.5, color: '#0B1C30', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  groupLine: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  suggestion: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#334155', lineHeight: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  callBtn: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#EEF2F6', borderRadius: 8 },
  callBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#0B1C30' },
  assignBtn: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(1,120,158,0.08)', borderRadius: 8 },
  assignBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary },
  statusLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8', textTransform: 'capitalize' },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#EEF2F6' },
  smallBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#334155' },
  collectBtn: { backgroundColor: '#16A34A' },

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
