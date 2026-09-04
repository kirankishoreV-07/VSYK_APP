import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, RefreshControl, Dimensions, Animated, LayoutAnimation, UIManager, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { formatPaise } from '../../lib/hooks/useDashboard';
import { buildCsvDocument, paiseToCsvAmount, shareCsvFile } from '../../lib/csvExport';
import { useAdminParentBack } from '../../lib/hooks/admin/useAdminParentBack';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GlobalSummary = {
  totalCollections: number;
  totalDividends: number;
  activeGroups: number;
};

type CustomerAnalytics = {
  customerId: string;
  name: string;
  totalPaid: number;
  totalDividendsReceived: number;
};

type GroupAnalytics = {
  id: string;
  name: string;
  value: number;
  status: string;
  totalCollected: number;
  totalDividends: number;
  progress: number;
  enrolledShares: number;
  customers: CustomerAnalytics[];
};

export default function AdminReports() {
  const router = useRouter();
  const handleBack = useAdminParentBack('/(admin)/settings');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [summary, setSummary] = useState<GlobalSummary>({ totalCollections: 0, totalDividends: 0, activeGroups: 0 });
  const [groupsData, setGroupsData] = useState<GroupAnalytics[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Chart State
  const [chartData, setChartData] = useState<{
    labels: string[],
    points: { x: number, y: number, amount: number }[],
    pathArea: string,
    pathLine: string,
    lastPoint: { x: number, y: number, amount: number } | null
  }>({ labels: [], points: [], pathArea: '', pathLine: '', lastPoint: null });

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAnalytics = async () => {
    try {
      const [groupsResult, transactionsResult, cashResult] = await Promise.all([
        supabase.from('chit_groups').select('*, chit_members(id, participation_share)'),
        supabase
          .from('chit_member_transactions')
          .select(`
            id, amount, payment_type, transaction_date, status,
            chit_members (
              id, chit_group_id,
              customers (id, full_name)
            )
          `)
          .eq('status', 'completed')
          .order('transaction_date', { ascending: true }),
        supabase
          .from('cash_collections')
          .select(`
            id, amount, recorded_at,
            chit_members (
              id, chit_group_id,
              customers (id, full_name)
            )
          `)
          .order('recorded_at', { ascending: true }),
      ]);

      if (groupsResult.error) throw groupsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (cashResult.error) throw cashResult.error;
      const groups = groupsResult.data || [];
      const transactions = transactionsResult.data || [];
      const cashCollections = cashResult.data || [];

      let globalCollections = 0;
      let globalDividends = 0;
      const activeGroups = groups.filter(g => g.status === 'active').length;

      // Map to hold group analytics
      const groupAnalyticsMap = new Map<string, GroupAnalytics>();

      groups.forEach(g => {
        groupAnalyticsMap.set(g.id, {
          id: g.id,
          name: g.name,
          value: g.value,
          status: g.status,
          totalCollected: 0,
          totalDividends: 0,
          progress: 0,
          enrolledShares: (g.chit_members || []).reduce(
            (total: number, member: any) => total + (Number(member.participation_share) || 1),
            0,
          ),
          customers: []
        });
      });

      // Temporary map to aggregate customer data within groups: group_id -> customer_id -> CustomerAnalytics
      const groupCustomerMap = new Map<string, Map<string, CustomerAnalytics>>();

      transactions.forEach((tx: any) => {
          const groupId = tx.chit_members?.chit_group_id;
          const customerId = tx.chit_members?.customers?.id;
          const customerName = tx.chit_members?.customers?.full_name || 'Unknown Member';
          
          if (!groupId || !customerId) return;

          const group = groupAnalyticsMap.get(groupId);
          if (!group) return;

          // Track Global & Group Totals
          if (tx.payment_type === 'installment') {
            globalCollections += tx.amount;
            group.totalCollected += tx.amount;
          } else if (tx.payment_type === 'dividend') {
            globalDividends += tx.amount;
            group.totalDividends += tx.amount;
          }

          // Track Customer Totals
          if (!groupCustomerMap.has(groupId)) {
            groupCustomerMap.set(groupId, new Map());
          }
          const customersInGroup = groupCustomerMap.get(groupId)!;
          
          if (!customersInGroup.has(customerId)) {
            customersInGroup.set(customerId, {
              customerId, name: customerName, totalPaid: 0, totalDividendsReceived: 0
            });
          }
          
          const cust = customersInGroup.get(customerId)!;
          if (tx.payment_type === 'installment') cust.totalPaid += tx.amount;
          if (tx.payment_type === 'dividend') cust.totalDividendsReceived += tx.amount;
      });

      cashCollections.forEach((collection: any) => {
        const groupId = collection.chit_members?.chit_group_id;
        const customerId = collection.chit_members?.customers?.id;
        const customerName = collection.chit_members?.customers?.full_name || 'Unknown Member';
        if (!groupId || !customerId) return;
        const group = groupAnalyticsMap.get(groupId);
        if (!group) return;

        const amount = Number(collection.amount || 0);
        globalCollections += amount;
        group.totalCollected += amount;
        if (!groupCustomerMap.has(groupId)) groupCustomerMap.set(groupId, new Map());
        const customersInGroup = groupCustomerMap.get(groupId)!;
        if (!customersInGroup.has(customerId)) {
          customersInGroup.set(customerId, {
            customerId, name: customerName, totalPaid: 0, totalDividendsReceived: 0,
          });
        }
        customersInGroup.get(customerId)!.totalPaid += amount;
      });

      // Finalize Group Analytics Array
      const finalGroupsArray: GroupAnalytics[] = [];
      groupAnalyticsMap.forEach((group, groupId) => {
        const totalExpected = group.value * group.enrolledShares;
        group.progress = totalExpected > 0
          ? Math.min((group.totalCollected / totalExpected) * 100, 100)
          : 0;
        
        // Attach customer data
        if (groupCustomerMap.has(groupId)) {
          group.customers = Array.from(groupCustomerMap.get(groupId)!.values());
        }
        
        finalGroupsArray.push(group);
      });

      // Sort groups: Active first, then by highest collections
      finalGroupsArray.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.totalCollected - a.totalCollected;
      });

      setSummary({ totalCollections: globalCollections, totalDividends: globalDividends, activeGroups });
      setGroupsData(finalGroupsArray);

      // --- Process Chart Data (Last 6 Months Collection Trends) ---
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const now = new Date();
      const last6Months: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
          label: monthNames[d.getMonth()],
          year: d.getFullYear(),
          month: d.getMonth(),
          amount: 0
        });
      }

      transactions.forEach((d: any) => {
          if (d.payment_type === 'installment') {
            const date = new Date(d.transaction_date);
            const m = last6Months.find(m => m.month === date.getMonth() && m.year === date.getFullYear());
            if (m) m.amount += Number(d.amount || 0);
          }
      });
      cashCollections.forEach((collection: any) => {
        const date = new Date(collection.recorded_at);
        const month = last6Months.find(m => m.month === date.getMonth() && m.year === date.getFullYear());
        if (month) month.amount += Number(collection.amount || 0);
      });

      const maxAmount = Math.max(...last6Months.map(m => m.amount), 1); 
      const width = SCREEN_WIDTH - 80;
      const height = 160;
      const paddingTop = 30;
      const paddingBottom = 20;
      const graphHeight = height - paddingTop - paddingBottom;

      const points = last6Months.map((m, index) => {
        const x = (index / 5) * width;
        const y = height - paddingBottom - (m.amount / maxAmount) * graphHeight;
        return { x, y, amount: m.amount };
      });

      const pathArea = `M0 160 ${points.map(p => `L${p.x} ${p.y}`).join(' ')} L${width} 160 Z`;
      const pathLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

      setChartData({
        labels: last6Months.map(m => m.label),
        points,
        pathArea,
        pathLine,
        lastPoint: points[points.length - 1]
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_member_transactions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_groups' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const scheduleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      fetchAnalytics();
    }, 500);
  };

  const toggleGroup = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedGroup !== id) {
      setSearchQuery(''); // clear search when opening a new group
      setExpandedGroup(id);
    } else {
      setExpandedGroup(null);
    }
    Haptics.selectionAsync();
  };

  const handleExport = async () => {
    try {
      const rows = groupsData.flatMap((group) => {
        if (group.customers.length === 0) {
          return [[group.name, group.status, '', '', paiseToCsvAmount(group.totalCollected), paiseToCsvAmount(group.totalDividends)]];
        }
        return group.customers.map((customer) => [
          group.name,
          group.status,
          customer.name,
          paiseToCsvAmount(customer.totalPaid),
          paiseToCsvAmount(group.totalCollected),
          paiseToCsvAmount(customer.totalDividendsReceived),
        ]);
      });
      const content = buildCsvDocument(
        [['Generated at', new Date().toISOString()]],
        ['Group', 'Status', 'Member', 'Member paid (INR)', 'Group collected (INR)', 'Member dividend (INR)'],
        rows,
        'Admin Collections Report',
      );
      await shareCsvFile({
        filename: `vsyk-admin-report-${new Date().toISOString().slice(0, 10)}.csv`,
        content,
        dialogTitle: 'Export admin collections report',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Export Failed', error?.message || 'The report could not be exported.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity
            onPress={handleBack}
            style={{ marginRight: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="#01789E">
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Reports & Analytics</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} accessibilityRole="button" accessibilityLabel="Export collections report">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="#005E7D">
            <Path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </Svg>
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#01789E" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Executive Summary */}
        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={[styles.kpiCard, { backgroundColor: '#005E7D' }]}>
            <Text style={[styles.kpiLabel, { color: '#C1E8FF' }]}>Total Collected</Text>
            <Text style={[styles.kpiValue, { color: '#FFFFFF' }]}>{formatPaise(summary.totalCollections)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
            <Text style={styles.kpiLabel}>Dividends Distributed</Text>
            <Text style={[styles.kpiValue, { color: '#DC2626' }]}>{formatPaise(summary.totalDividends)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
            <Text style={styles.kpiLabel}>Active Groups</Text>
            <Text style={[styles.kpiValue, { color: '#01789E' }]}>{summary.activeGroups}</Text>
          </View>
        </View>

        {/* Global Trend Chart */}
        <Text style={styles.sectionTitle}>Collection Velocity (6 Mo)</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartWrapper}>
            <Svg width={SCREEN_WIDTH - 80} height="160">
              <Defs>
                <LinearGradient id="gradient-chart" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#005E7D" stopOpacity="0.2" />
                  <Stop offset="1" stopColor="#005E7D" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {/* Grid Lines */}
              <Line x1="0" y1="40" x2="400" y2="40" stroke="#F1F5F9" strokeWidth="1" />
              <Line x1="0" y1="80" x2="400" y2="80" stroke="#F1F5F9" strokeWidth="1" />
              <Line x1="0" y1="120" x2="400" y2="120" stroke="#F1F5F9" strokeWidth="1" />
              
              <Path d={chartData.pathArea} fill="url(#gradient-chart)" />
              <Path d={chartData.pathLine} fill="none" stroke="#005E7D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              
              {chartData.points.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r="4" fill={i === chartData.points.length - 1 ? "#10D7CD" : "#FFFFFF"} stroke="#005E7D" strokeWidth={i === chartData.points.length - 1 ? 0 : 2} />
              ))}
            </Svg>

            {chartData.lastPoint && chartData.lastPoint.amount > 0 && (
              <View style={[styles.floatingIndicator, { right: 0, top: Math.max(0, chartData.lastPoint.y - 30) }]}>
                <Text style={styles.floatingIndicatorText}>{formatPaise(chartData.lastPoint.amount)}</Text>
              </View>
            )}
          </View>

          <View style={styles.chartLabels}>
            {chartData.labels.map(month => (
              <Text key={month} style={styles.chartLabelText}>{month}</Text>
            ))}
          </View>
        </View>

        {/* Group By Group Breakdown */}
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Group Analytics</Text>
        
        {groupsData.length === 0 && !loading && (
          <Text style={styles.emptyText}>No groups found to analyze.</Text>
        )}

        {groupsData.map(group => {
          const isExpanded = expandedGroup === group.id;
          
          return (
            <View key={group.id} style={styles.groupCard}>
              <TouchableOpacity style={styles.groupHeader} activeOpacity={0.8} onPress={() => toggleGroup(group.id)}>
                <View style={styles.groupHeaderTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupValueText}>Value: {formatPaise(group.value)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: group.status === 'active' ? '#ECFDF5' : '#F1F5F9' }]}>
                    <Text style={[styles.statusText, { color: group.status === 'active' ? '#059669' : '#64748B' }]}>
                      {group.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* KPI Row */}
                <View style={styles.groupKpiRow}>
                  <View>
                    <Text style={styles.kpiLabelSmall}>Collected</Text>
                    <Text style={styles.kpiValueSmall}>{formatPaise(group.totalCollected)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.kpiLabelSmall}>Dividends</Text>
                    <Text style={[styles.kpiValueSmall, { color: '#DC2626' }]}>{formatPaise(group.totalDividends)}</Text>
                  </View>
                </View>

                {/* Actual collected amount divided by expected value for enrolled shares. */}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${group.progress}%` }]} />
                </View>

                <View style={styles.expandRow}>
                  <Text style={styles.expandText}>{isExpanded ? 'Hide Customer Breakdown' : 'View Customer Breakdown'}</Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="#94A3B8" style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                    <Path d="M7 10l5 5 5-5H7z" />
                  </Svg>
                </View>
              </TouchableOpacity>

              {/* Expanded Customer Details */}
              {isExpanded && (
                <View style={styles.customerList}>
                  
                  {/* Search Bar */}
                  <View style={styles.searchContainer}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="#94A3B8" style={{ marginRight: 8 }}>
                      <Path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </Svg>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by member name"
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  <View style={styles.customerListHeaderRow}>
                    <Text style={styles.customerListHeader}>Member Name</Text>
                    <View style={styles.customerListHeaderRight}>
                      <Text style={[styles.customerListHeader, { marginRight: 20 }]}>Paid</Text>
                      <Text style={styles.customerListHeader}>Dividend</Text>
                    </View>
                  </View>
                  
                  {group.customers.length === 0 ? (
                    <Text style={styles.emptyTextSm}>No transactions recorded for members yet.</Text>
                  ) : (
                    group.customers
                      .filter(cust => cust.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .sort((a, b) => b.totalPaid - a.totalPaid)
                      .map(cust => (
                        <TouchableOpacity 
                          key={cust.customerId} 
                          style={styles.customerRow}
                          activeOpacity={0.7}
                          onPress={() => router.push(`/(admin)/customers/${cust.customerId}`)}
                        >
                          <Text style={styles.customerName} numberOfLines={1}>{cust.name}</Text>
                          <View style={styles.customerValues}>
                            <Text style={styles.customerPaid}>{formatPaise(cust.totalPaid)}</Text>
                            <Text style={styles.customerDiv}>{formatPaise(cust.totalDividendsReceived)}</Text>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="#CBD5E1">
                              <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" opacity={0} />
                              <Path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                            </Svg>
                          </View>
                        </TouchableOpacity>
                      ))
                  )}
                  {group.customers.filter(cust => cust.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && group.customers.length > 0 && (
                    <Text style={styles.emptyTextSm}>No members match your search.</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBarTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: '#0B1C30',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  exportBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#005E7D',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: '#0B1C30',
    marginBottom: 16,
    marginTop: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 16,
    justifyContent: 'center',
  },
  kpiLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  kpiValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: '#0B1C30',
  },
  
  // Chart Styles
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartWrapper: {
    height: 160,
    position: 'relative',
    marginBottom: 16,
  },
  floatingIndicator: {
    position: 'absolute',
    backgroundColor: '#0B1C30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    transform: [{ translateY: -10 }],
  },
  floatingIndicatorText: {
    color: '#FFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  chartLabelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#94A3B8',
  },

  // Group Cards
  emptyText: {
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    fontStyle: 'italic',
  },
  emptyTextSm: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  groupHeader: {
    padding: 16,
  },
  groupHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  groupName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: '#0B1C30',
    letterSpacing: -0.5,
  },
  groupValueText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  groupKpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kpiLabelSmall: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  kpiValueSmall: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: '#0F172A',
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#01789E',
    borderRadius: 3,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    gap: 4,
  },
  expandText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#64748B',
  },

  // Customer List
  customerList: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  customerListHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  customerListHeaderRight: {
    flexDirection: 'row',
    width: 140,
    justifyContent: 'space-between',
  },
  customerListHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  customerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
    paddingRight: 10,
  },
  customerValues: {
    flexDirection: 'row',
    width: 140,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerPaid: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#059669',
    width: 60,
  },
  customerDiv: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#DC2626',
    width: 60,
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 36,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#0F172A',
  },
});
