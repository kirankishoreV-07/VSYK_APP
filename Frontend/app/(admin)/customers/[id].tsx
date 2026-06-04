import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { formatPaise, formatShortDate } from '../../../lib/hooks/useDashboard';
import { useAdminCustomerDetail } from '../../../lib/hooks/useAdminCustomerDetail';

export default function CustomerDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const { 
    customer, 
    memberships, 
    timeline, 
    health, 
    unlinkedPayments,
    loading, 
    error 
  } = useAdminCustomerDetail(id as string);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#01789E" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (error || !customer) {
    return (
      <SafeAreaView style={styles.container}>
         <View style={styles.appBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="#01789E">
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Error</Text>
        </View>
        <Text style={styles.errorText}>{error || 'Customer not found'}</Text>
      </SafeAreaView>
    );
  }

  const handleCall = () => {
    if (customer.mobile) {
      Linking.openURL(`tel:${customer.mobile}`);
    }
  };

  const handleEmail = () => {
    if (customer.email) {
      Linking.openURL(`mailto:${customer.email}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="#01789E">
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Customer Details</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card & Health Summary */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{customer.full_name?.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{customer.full_name}</Text>
              <Text style={styles.profileId}>ID: {customer.customer_id} • {customer.customer_type}</Text>
            </View>
          </View>

          {/* Contact Actions */}
          <View style={styles.contactActions}>
             <TouchableOpacity 
               style={[styles.actionButton, !customer.mobile && styles.actionButtonDisabled]} 
               onPress={handleCall}
               disabled={!customer.mobile}
             >
               <Svg width={18} height={18} viewBox="0 0 24 24" fill={customer.mobile ? "#01789E" : "#94A3B8"}>
                 <Path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
               </Svg>
               <Text style={[styles.actionText, !customer.mobile && styles.actionTextDisabled]}>Call</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={[styles.actionButton, !customer.email && styles.actionButtonDisabled]} 
               onPress={handleEmail}
               disabled={!customer.email}
             >
               <Svg width={18} height={18} viewBox="0 0 24 24" fill={customer.email ? "#01789E" : "#94A3B8"}>
                 <Path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
               </Svg>
               <Text style={[styles.actionText, !customer.email && styles.actionTextDisabled]}>Email</Text>
             </TouchableOpacity>
          </View>

          {/* Health Summary */}
          <View style={styles.healthSummary}>
            <View style={styles.healthRow}>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Outstanding</Text>
                <Text style={styles.healthValueRed}>{formatPaise(health.totalOutstanding)}</Text>
              </View>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Overdue</Text>
                <Text style={health.overdueCount > 0 ? styles.healthValueRed : styles.healthValueGreen}>
                  {health.overdueCount} Months
                </Text>
              </View>
            </View>
            <View style={styles.healthRow}>
               <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Next Due</Text>
                <Text style={styles.healthValue}>{health.nextDueDate ? formatShortDate(health.nextDueDate.toISOString()) : 'N/A'}</Text>
              </View>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Last Activity</Text>
                <Text style={styles.healthValue}>{health.lastActivityDate ? formatShortDate(health.lastActivityDate.toISOString()) : 'None'}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active Groups</Text>

        {memberships.length === 0 ? (
          <Text style={styles.emptyText}>No group data found for this customer.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupsPillsScroll}>
            {memberships.map((mem) => {
              const group = mem.chit_groups;
              return (
                <View key={mem.id} style={styles.groupPill}>
                  <Text style={styles.groupPillName}>{group.name}</Text>
                  <Text style={styles.groupPillValue}>{formatPaise(group.value)} • {group.duration_months} M</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Payment Timeline</Text>
        
        {timeline.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming or past schedule found.</Text>
        ) : (
          <View style={styles.timelineList}>
            {timeline.map((item) => {
              
              let statusBg = '#F1F5F9';
              let statusColor = '#64748B';
              if (item.status === 'Full' || item.status === 'Settled') {
                statusBg = '#DCFCE7';
                statusColor = '#166534';
              } else if (item.status === 'Partial') {
                statusBg = '#FEF3C7';
                statusColor = '#92400E';
              } else if (item.status === 'Unpaid') {
                statusBg = item.isOverdue ? '#FEE2E2' : '#F1F5F9';
                statusColor = item.isOverdue ? '#991B1B' : '#64748B';
              }

              const dDate = item.dueDate ? new Date(item.dueDate) : null;
              const dateStr = dDate ? dDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD';

              return (
                <View key={item.id} style={styles.timelineCard}>
                   <View style={styles.timelineHeader}>
                     <View>
                       <Text style={styles.timelineMonth}>{new Date(item.monthDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                       <Text style={styles.timelineGroup}>{item.groupName} • Due: {dateStr}</Text>
                     </View>
                     <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                       <Text style={[styles.statusText, { color: statusColor }]}>{item.status === 'Settled' ? 'Settled' : (item.isOverdue ? 'Overdue' : item.status)}</Text>
                     </View>
                   </View>
                   
                   <View style={styles.timelineAmounts}>
                     <View style={styles.amtBox}>
                       <Text style={styles.amtLabel}>Payable</Text>
                       <Text style={styles.amtValue}>{formatPaise(item.payableAmount)}</Text>
                     </View>
                     <View style={styles.amtBox}>
                       <Text style={styles.amtLabel}>Paid</Text>
                       <Text style={styles.amtValueGreen}>{formatPaise(item.paidAmount)}</Text>
                     </View>
                     <View style={styles.amtBox}>
                       <Text style={styles.amtLabel}>Remaining</Text>
                       <Text style={styles.amtValueRed}>{item.status === 'Settled' ? '₹0' : formatPaise(item.remainingAmount)}</Text>
                     </View>
                   </View>

                   {/* Markers */}
                   {(item.isPostWin || item.participatedInAuction) && (
                     <View style={styles.markersRow}>
                       {item.isPostWin && (
                         <View style={styles.markerBadge}>
                           <Text style={styles.markerText}>Post-Win</Text>
                         </View>
                       )}
                       {item.participatedInAuction && (
                         <View style={[styles.markerBadge, { backgroundColor: '#E0E7FF' }]}>
                           <Text style={[styles.markerText, { color: '#3730A3' }]}>Participated</Text>
                         </View>
                       )}
                     </View>
                   )}

                   {/* Sub transactions */}
                   {item.transactions.length > 0 && (
                     <View style={styles.subTxnsList}>
                       {item.transactions.map((tx) => (
                         <View key={tx.id} style={styles.subTxnItem}>
                           <Text style={styles.subTxnDate}>{formatShortDate(tx.transaction_date)}</Text>
                           <Text style={styles.subTxnType}>{tx.payment_type === 'installment' ? 'Installment' : tx.payment_type}</Text>
                           <Text style={styles.subTxnAmt}>+{formatPaise(tx.amount)}</Text>
                         </View>
                       ))}
                     </View>
                   )}
                </View>
              );
            })}
          </View>
        )}

        {unlinkedPayments.length > 0 && (
          <View style={styles.unlinkedContainer}>
            <Text style={styles.sectionTitle}>Unlinked Payments</Text>
            {unlinkedPayments.map(tx => (
               <View key={tx.id} style={styles.unlinkedItem}>
                 <View>
                    <Text style={styles.unlinkedDate}>{formatShortDate(tx.date.toISOString())} • {tx.groupName || 'Unknown Group'}</Text>
                    <Text style={styles.unlinkedType}>{tx.type}</Text>
                 </View>
                 <Text style={styles.unlinkedAmt}>{formatPaise(tx.amount)}</Text>
               </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 64,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { padding: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#164E63' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  errorText: { fontFamily: 'Inter_500Medium', color: '#991B1B', textAlign: 'center', marginTop: 40 },

  profileCard: {
    backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#01789E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FFFFFF' },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#0B1C30' },
  profileId: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  
  contactActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionButton: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, borderRadius: 8, backgroundColor: '#F1F5F9',
  },
  actionButtonDisabled: { backgroundColor: '#F8FAFC', opacity: 0.7 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#01789E' },
  actionTextDisabled: { color: '#94A3B8' },

  healthSummary: {
    backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, gap: 12,
  },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between' },
  healthItem: { flex: 1 },
  healthLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginBottom: 4 },
  healthValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  healthValueRed: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#991B1B' },
  healthValueGreen: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#166534' },

  sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: '#164E63', marginBottom: 12 },
  emptyText: { fontFamily: 'Inter_400Regular', color: '#64748B', fontStyle: 'italic', marginBottom: 12 },

  groupsPillsScroll: { marginBottom: 8 },
  groupPill: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 12,
  },
  groupPillName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  groupPillValue: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },

  timelineList: { gap: 16 },
  timelineCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16,
  },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  timelineMonth: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#0B1C30' },
  timelineGroup: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  timelineAmounts: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', 
    padding: 12, borderRadius: 8, marginBottom: 12
  },
  amtBox: { alignItems: 'center' },
  amtLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B', marginBottom: 4 },
  amtValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0B1C30' },
  amtValueGreen: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#166534' },
  amtValueRed: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#991B1B' },

  markersRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  markerBadge: { 
    backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 
  },
  markerText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#92400E' },

  subTxnsList: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, gap: 8 },
  subTxnItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subTxnDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', flex: 1 },
  subTxnType: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0B1C30', flex: 1, textAlign: 'center' },
  subTxnAmt: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#166534', flex: 1, textAlign: 'right' },

  unlinkedContainer: { marginTop: 24, padding: 16, backgroundColor: '#FFF7ED', borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA' },
  unlinkedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  unlinkedDate: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#9A3412' },
  unlinkedType: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#C2410C', marginTop: 2 },
  unlinkedAmt: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#9A3412' },
});
