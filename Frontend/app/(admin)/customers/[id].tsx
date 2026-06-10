import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../../lib/constants';
import { useCustomerDetailData } from '../../../lib/hooks/admin/useCustomerDetailData';
import { CustomerHeader } from './_components/CustomerHeader';
import { KPIStrip } from './_components/KPIStrip';
import { OverviewTab } from './_components/OverviewTab';

export default function CustomerDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const customerId = typeof id === 'string' ? id : '';

  const { data, isLoading, error } = useCustomerDetailData(customerId);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
        </View>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load customer</Text>
            <Text style={styles.errorText}>{error?.message || 'An error occurred'}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { customer, memberships, schedules, transactions, auctions, kpiMetrics } = data;

  if (!customer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Customer not found</Text>
            <Text style={styles.errorText}>The requested customer does not exist.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate overdue count for risk badge
  const overdueCount = schedules.filter((s) => {
    if (s.paid) return false;
    const dueDate = new Date(s.due_date);
    const now = new Date();
    return dueDate < now;
  }).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Customer Header */}
        <CustomerHeader
          customer={customer}
          overdueCount={overdueCount}
          onTimePercentage={kpiMetrics.onTimePercentage}
        />

        {/* KPI Strip */}
        <KPIStrip metrics={kpiMetrics} />

        {/* Overview Content - inline on hub */}
        <View style={styles.overviewSection}>
          <OverviewTab
            memberships={memberships}
            transactions={transactions}
            schedules={schedules}
            auctions={auctions}
            overdueCount={overdueCount}
            onTimePercentage={kpiMetrics.onTimePercentage}
            outstanding={kpiMetrics.outstanding}
            onViewAllTransactions={() => router.push(`/(admin)/customers/${customerId}/payments`)}
          />
        </View>

        {/* Section Navigator - Cards to other screens */}
        <View style={styles.sectionNavigator}>
          <Text style={styles.navigatorTitle}>Detailed Views</Text>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(admin)/customers/${customerId}/groups`)}
          >
            <View style={[styles.navIcon, { backgroundColor: '#E0F2FE' }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#005E7D">
                <Path d="M4 10h3v7H4zM10.5 10h3v7h-3zM2 19h20v3H2zM17 10h3v7h-3zM12 1L2 6v2h20V6z" />
              </Svg>
            </View>
            <View style={styles.navContent}>
              <Text style={styles.navTitle}>Groups</Text>
              <Text style={styles.navSubtitle}>View all chit groups with payment history</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(admin)/customers/${customerId}/payments`)}
          >
            <View style={[styles.navIcon, { backgroundColor: '#DCFCE7' }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#16A34A">
                <Path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-2 0H3V6h14v8zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm13 0v11c0 1.1-.9 2-2 2H4v-2h17V7h2z" />
              </Svg>
            </View>
            <View style={styles.navContent}>
              <Text style={styles.navTitle}>Payments</Text>
              <Text style={styles.navSubtitle}>Cross-group payment history and filters</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(admin)/customers/${customerId}/auctions`)}
          >
            <View style={[styles.navIcon, { backgroundColor: '#EDE9FE' }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#7C3AED">
                <Path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
              </Svg>
            </View>
            <View style={styles.navContent}>
              <Text style={styles.navTitle}>Auctions</Text>
              <Text style={styles.navSubtitle}>Auction participation and outcomes</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(admin)/customers/${customerId}/diagnostics`)}
          >
            <View style={[styles.navIcon, { backgroundColor: '#FEF3C7' }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#D97706">
                <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </Svg>
            </View>
            <View style={styles.navContent}>
              <Text style={styles.navTitle}>Diagnostics</Text>
              <Text style={styles.navSubtitle}>Razorpay orders, failed payments, data quality</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => router.push(`/(admin)/customers/${customerId}/activity`)}
          >
            <View style={[styles.navIcon, { backgroundColor: '#F1F5F9' }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
                <Path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
              </Svg>
            </View>
            <View style={styles.navContent}>
              <Text style={styles.navTitle}>Activity</Text>
              <Text style={styles.navSubtitle}>Timeline of customer actions (Coming Soon)</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </Svg>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  overviewSection: {
    backgroundColor: '#F8FAFC',
  },
  sectionNavigator: {
    padding: 16,
    paddingBottom: 40,
  },
  navigatorTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: '#0B1C30',
    marginBottom: 16,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  navIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  navContent: {
    flex: 1,
  },
  navTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#0B1C30',
    marginBottom: 2,
  },
  navSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    maxWidth: 400,
  },
  errorTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#B91C1C',
    marginBottom: 8,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
});
