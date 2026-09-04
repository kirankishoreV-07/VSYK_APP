import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../components/AppLogo';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { formatPaise } from '../../lib/hooks/useDashboard';
import {
  buildCollectionPieData,
  countTodayActivity,
  EMPTY_COLLECTION_PIE_DATA,
  formatMomLabel,
  formatRelativeTime,
  mergeDashboardActivity,
  sumCollectionAmounts,
  type CollectionPieData,
  type DashboardActivity,
} from '../../lib/dashboardAnalytics';
import { filterScheduledUpcomingForTab } from '../../lib/auctionUtils';
import { CollectionPieChart } from './_components/CollectionPieChart';

export default function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState({
    totalAUM: 0,
    members: 0,
    collection: 0,
    auctions: 0,
    dividends: 0,
  });
  const [recentActivity, setRecentActivity] = useState<DashboardActivity[]>([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [selectedPieIndex, setSelectedPieIndex] = useState<number | null>(null);
  const [pieData, setPieData] = useState<CollectionPieData>(EMPTY_COLLECTION_PIE_DATA);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDashboardData = async () => {
    try {
      // AUM (Value in paise, so divide by 100)
      const { data: groups, error: groupsError } = await supabase.from('chit_groups').select('value');
      if (groupsError) throw groupsError;
      const aum = groups ? groups.reduce((acc, g) => acc + Number(g.value || 0), 0) / 100 : 0;

      // Members
      const { count: memberCount, error: customersError } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      if (customersError) throw customersError;

      const { data: deposits, error: depositsError } = await supabase
        .from('chit_member_transactions')
        .select('amount, transaction_date, payment_type, status')
        .eq('status', 'completed');
      if (depositsError) throw depositsError;

      const { data: cashCollections, error: cashCollectionsError } = await supabase
        .from('cash_collections')
        .select('amount, recorded_at');
      if (cashCollectionsError) throw cashCollectionsError;

      const collection = sumCollectionAmounts(deposits || [], cashCollections || []);

      const { data: auctionRows, error: auctionsError } = await supabase
        .from('auctions')
        .select('id, chit_group_id, auction_number, status, min_bid, max_bid, scheduled_at, closes_at');
      if (auctionsError) throw auctionsError;
      const auctionCount = filterScheduledUpcomingForTab(auctionRows || []).length
        + (auctionRows || []).filter((a) => a.status === 'live').length;

      // Dividends (payment_type=dividend and status=completed)
      const { data: dividendTx, error: dividendsError } = await supabase
        .from('chit_member_transactions')
        .select('amount')
        .eq('payment_type', 'dividend')
        .eq('status', 'completed');
      if (dividendsError) throw dividendsError;
        
      const dividends = dividendTx ? dividendTx.reduce((acc, d) => acc + Number(d.amount || 0), 0) : 0;

      setMetrics({
        totalAUM: aum,
        members: memberCount || 0,
        collection: collection,
        auctions: auctionCount || 0,
        dividends: dividends,
      });

      const [{ data: rawActivity }, { data: rawCashActivity }] = await Promise.all([
        supabase
          .from('chit_member_transactions')
          .select(`
            id, amount, payment_type, transaction_date, status,
            chit_members (
              customers (full_name),
              chit_groups (name)
            )
          `)
          .eq('status', 'completed')
          .order('transaction_date', { ascending: false })
          .limit(30),
        supabase
          .from('cash_collections')
          .select(`
            id, amount, month_number, recorded_at,
            chit_members (
              customers (full_name),
              chit_groups (name)
            )
          `)
          .order('recorded_at', { ascending: false })
          .limit(30),
      ]);

      const mergedActivity = mergeDashboardActivity(rawActivity || [], rawCashActivity || []);
      setRecentActivity(mergedActivity.slice(0, 20));

      const installmentTx = (deposits || [])
        .filter((d) => d.payment_type === 'installment')
        .map((d) => ({ date: d.transaction_date, amount: d.amount }));
      const cashForChart = (cashCollections || []).map((c) => ({
        date: c.recorded_at,
        amount: c.amount,
      }));

      setPieData(buildCollectionPieData(installmentTx, cashForChart));
      setSelectedPieIndex(null);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setPieData(EMPTY_COLLECTION_PIE_DATA);
      setSelectedPieIndex(null);
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      fetchDashboardData();
    }, 300);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_groups' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_member_transactions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_collections' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const formatRupees = (rupees: number) =>
    `₹${Math.round(rupees).toLocaleString('en-IN')}`;

  const todayActivityCount = useMemo(() => countTodayActivity(recentActivity), [recentActivity]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <AppLogo size={36} />
          <Text style={styles.appBarTitle}>VSYK CHITS</Text>
        </View>
        <View style={styles.iconButton} accessibilityElementsHidden>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
            <Path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </Svg>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#005E7D" />}
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(admin)/customers'); }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
              <Path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </Svg>
            <Text style={styles.actionBtnPrimaryText}>New Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(admin)/groups'); }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#006A65">
              <Path d="M4 10h3v7H4zM10.5 10h3v7h-3zM2 19h20v3H2zM17 10h3v7h-3zM12 1L2 6v2h20V6z" />
            </Svg>
            <Text style={styles.actionBtnSecondaryText}>Chit Groups</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.followupsCard}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(admin)/collections/followups'); }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.followupsTitle}>Collections Follow-ups</Text>
            <Text style={styles.followupsSub}>Today's overdue/pending customers, ready to call</Text>
          </View>
          <Text style={{ fontSize: 20, color: '#005E7D' }}>{'→'}</Text>
        </TouchableOpacity>

        {/* Bento KPI Grid */}
        <View style={styles.bentoGrid}>
          {/* Total AUM */}
          <View style={[styles.card, styles.cardFull, styles.blueTintShadow]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>TOTAL AUM</Text>
              <View style={styles.iconBoxPrimary}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#005E7D">
                  <Path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </Svg>
              </View>
            </View>
            <Text testID="dashboard-total-aum" style={styles.headlineLg}>{formatRupees(metrics.totalAUM)}</Text>
            <View style={styles.trendRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="#006A65">
                <Path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
              </Svg>
              <Text style={styles.trendText}>Live from DB</Text>
            </View>
          </View>

          {/* Active Members */}
          <View style={[styles.card, styles.cardHalf]}>
            <Text style={styles.cardLabel}>CUSTOMERS</Text>
            <Text testID="dashboard-customers" style={styles.headlineMd}>{metrics.members.toLocaleString('en-IN')}</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#006A65' }]} />
            </View>
          </View>

          {/* Monthly Collection */}
          <View style={[styles.card, styles.cardHalf]}>
            <Text style={styles.cardLabel}>COLLECTION</Text>
            <Text testID="dashboard-collection" style={styles.headlineMd}>{formatPaise(metrics.collection)}</Text>
            <View style={styles.trendRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="#005E7D">
                <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </Svg>
              <Text style={styles.trendTextPrimary}>TOTAL DEPOSITS</Text>
            </View>
          </View>

          {/* Pending Auctions */}
          <View style={[styles.card, styles.cardHalf]}>
            <Text style={styles.cardLabel}>AUCTIONS</Text>
            <Text testID="dashboard-auctions" style={styles.headlineMd}>{metrics.auctions}</Text>
            <Text style={styles.subtitleItalic}>Active/Upcoming</Text>
          </View>

          {/* Dividend Payouts */}
          <View style={[styles.card, styles.cardHalf]}>
            <Text style={styles.cardLabel}>DIVIDENDS</Text>
            <Text testID="dashboard-dividends" style={styles.headlineMd}>{formatPaise(metrics.dividends)}</Text>
            <View style={styles.trendRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="#006A65">
                <Path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
              </Svg>
              <Text style={styles.trendTextSecondary}>PROCESSED</Text>
            </View>
          </View>
        </View>

        <View style={[styles.chartCard, styles.blueTintShadow]}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chartTitle}>Collection Breakdown</Text>
              <Text style={styles.chartSubtitle}>
                {pieData.summary.rangeLabel} · Tap any slice to drill down
              </Text>
            </View>
          </View>

          <View style={styles.chartStatsRow}>
            <View style={styles.chartStatPill}>
              <Text style={styles.chartStatLabel}>6M TOTAL</Text>
              <Text style={styles.chartStatVal}>{formatPaise(pieData.summary.total6M)}</Text>
            </View>
            <View style={styles.chartStatPill}>
              <Text style={styles.chartStatLabel}>AVG / MO</Text>
              <Text style={styles.chartStatVal}>{formatPaise(pieData.summary.avgMonthly)}</Text>
            </View>
            <View style={styles.chartStatPill}>
              <Text style={styles.chartStatLabel}>VS LAST MO</Text>
              <Text style={[
                styles.chartStatVal,
                { color: (pieData.summary.momChangePct ?? 0) >= 0 ? '#006A65' : '#BA1A1A' },
              ]}>
                {formatMomLabel(pieData.summary.momChangePct)}
              </Text>
            </View>
          </View>

          <CollectionPieChart
            data={pieData ?? EMPTY_COLLECTION_PIE_DATA}
            selectedIndex={selectedPieIndex}
            onSelectSlice={setSelectedPieIndex}
          />
        </View>

        <View style={styles.activitySection}>
          <View style={styles.activityHeaderRow}>
            <Text style={styles.activityTitle}>Live Activity</Text>
            {todayActivityCount > 0 && (
              <View style={styles.activityTodayBadge}>
                <Text style={styles.activityTodayBadgeText}>{todayActivityCount} today</Text>
              </View>
            )}
          </View>

          {recentActivity.length === 0 ? (
            <View style={styles.activityEmptyCard}>
              <Text style={styles.activityEmptyText}>No recent collections yet.</Text>
              <Text style={styles.activityEmptySub}>Installments and cash collections will appear here in real time.</Text>
            </View>
          ) : (
            <>
              {(showAllActivity ? recentActivity : recentActivity.slice(0, 5)).map((activity, index) => (
                <View key={activity.id || index} style={styles.activityCard}>
                  <View style={[styles.activityIconBox, { backgroundColor: activity.type === 'credit' ? '#C1E8FF' : '#54FAEF' }]}>
                    {activity.type === 'credit' ? (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="#001E2B"><Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></Svg>
                    ) : (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="#00201E"><Path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" /></Svg>
                    )}
                  </View>
                  <View style={styles.activityContent}>
                    <View style={styles.activityTitleRow}>
                      <Text style={styles.activityName} numberOfLines={1}>{activity.description}</Text>
                      <View style={styles.activityTypePill}>
                        <Text style={styles.activityTypePillText}>{activity.paymentLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.activityDesc} numberOfLines={1}>
                      {activity.category || 'Transaction'}
                      {activity.monthNumber ? ` · Month ${activity.monthNumber}` : ''}
                      {' · '}{formatRelativeTime(activity.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.activityAmount, { color: activity.type === 'credit' ? '#006A65' : '#BA1A1A' }]}>
                    {activity.type === 'credit' ? '+' : '-'}{formatPaise(activity.amount)}
                  </Text>
                </View>
              ))}
              {recentActivity.length > 5 && (
                <TouchableOpacity 
                  style={{ alignSelf: 'center', marginTop: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F1F5F9' }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowAllActivity(!showAllActivity);
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#005E7D', fontSize: 14 }}>
                    {showAllActivity ? 'View Less' : 'View More'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 40,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  appBarTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: '#155E75', // cyan-800
    letterSpacing: -0.5,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // space for tab bar
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnPrimary: {
    backgroundColor: '#005E7D',
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#006A65',
  },
  actionBtnPrimaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  actionBtnSecondaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#006A65',
    letterSpacing: 0.5,
  },
  followupsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  followupsTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    color: '#0B1C30',
  },
  followupsSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardFull: {
    width: '100%',
  },
  cardHalf: {
    width: '47.5%', // approximate to handle gap
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  blueTintShadow: {
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  iconBoxPrimary: {
    padding: 8,
    backgroundColor: 'rgba(0, 94, 125, 0.1)',
    borderRadius: 8,
  },
  headlineLg: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 32,
    color: '#0B1C30',
  },
  headlineMd: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 24,
    color: '#0B1C30',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#006A65',
  },
  trendTextPrimary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#005E7D',
  },
  trendTextSecondary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#006A65',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subtitleItalic: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 218, 214, 0.3)',
    borderColor: 'rgba(186, 26, 26, 0.1)',
  },
  errorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#BA1A1A',
    letterSpacing: 0.5,
  },
  errorHeadline: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 24,
    color: '#BA1A1A',
  },
  errorBtn: {
    backgroundColor: '#BA1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  errorBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 32,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  chartTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 20,
    color: '#0B1C30',
  },
  chartSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#64748B',
  },
  chartStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chartStatPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  chartStatLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  chartStatVal: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 12,
    color: '#005E7D',
  },
  activitySection: {
    marginBottom: 32,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  activityTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 20,
    color: '#0B1C30',
  },
  activityTodayBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  activityTodayBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#005E7D',
  },
  activityEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  activityEmptyText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#64748B',
    marginBottom: 6,
  },
  activityEmptySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  activityName: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#0B1C30',
  },
  activityTypePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },
  activityTypePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    color: '#005E7D',
    letterSpacing: 0.4,
  },
  activityDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748B',
  },
  activityAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#006A65',
  },
});
