import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useCustomerDetailData } from '../../../lib/hooks/admin/useCustomerDetailData';
import { CustomerHeader } from './_components/CustomerHeader';
import { KPIStrip } from './_components/KPIStrip';
import { OverviewTab } from './_components/OverviewTab';
import { AdminColors } from './_components/adminStyles';
import { computeCustomerUpcomingDues } from '../../../lib/memberGroupHistory';
import { useAdminParentBack } from '../../../lib/hooks/admin/useAdminParentBack';

function HubAppBar({ onBack }: { onBack: () => void }) {
    return (
        <View style={styles.appBar}>
            <View style={styles.appBarLeft}>
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Back to customers"
                >
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill={AdminColors.primary}>
                        <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </Svg>
                </TouchableOpacity>
                <Text style={styles.appBarTitle}>VSYK Chits</Text>
            </View>
        </View>
    );
}

export default function CustomerDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const customerId = typeof id === 'string' ? id : '';
    const handleBack = useAdminParentBack('/(admin)/customers');

    const { data, isLoading, error } = useCustomerDetailData(customerId);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <HubAppBar onBack={handleBack} />
                <ActivityIndicator size="large" color={AdminColors.primaryContainer} style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView style={styles.container}>
                <HubAppBar onBack={handleBack} />
                <View style={styles.errorContainer}>
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>Unable to load customer</Text>
                        <Text style={styles.errorText}>{error?.message || 'An error occurred'}</Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const { customer, memberships, schedules, transactions, auctions, participants, cashCollections, kpiMetrics } = data;

    if (!customer) {
        return (
            <SafeAreaView style={styles.container}>
                <HubAppBar onBack={handleBack} />
                <View style={styles.errorContainer}>
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>Customer not found</Text>
                        <Text style={styles.errorText}>The requested customer does not exist.</Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const overdueCount = computeCustomerUpcomingDues({
        memberships,
        schedules,
        cashCollections,
        transactions,
        auctions,
        limit: 100,
    }).filter((d) => d.status === 'overdue').length;

    const paymentCount = transactions.filter(
        (t) => (t.status === 'completed' || t.status === 'success') && t.payment_type === 'installment',
    ).length;

    const auctionCount = new Set(participants.map((p) => p.auction_id)).size;

    return (
        <SafeAreaView style={styles.container}>
            <HubAppBar onBack={handleBack} />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <CustomerHeader
                    customer={customer}
                    overdueCount={overdueCount}
                    onTimePercentage={kpiMetrics.onTimePercentage}
                />

                <KPIStrip
                    counts={{
                        groups: memberships.length,
                        payments: paymentCount,
                        auctions: auctionCount,
                    }}
                    onNavigateGroups={() => router.push(`/(admin)/customers/${customerId}/groups`)}
                    onNavigatePayments={() => router.push(`/(admin)/customers/${customerId}/payments`)}
                    onNavigateAuctions={() => router.push(`/(admin)/customers/${customerId}/auctions`)}
                    onNavigateDiagnostics={() => router.push(`/(admin)/customers/${customerId}/diagnostics`)}
                />

                <OverviewTab
                    memberships={memberships}
                    transactions={transactions}
                    schedules={schedules}
                    auctions={auctions}
                    cashCollections={cashCollections}
                    onViewAllTransactions={() => router.push(`/(admin)/customers/${customerId}/payments`)}
                    onViewGroupPayments={() => router.push(`/(admin)/customers/${customerId}/groups`)}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AdminColors.bgTertiary,
    },
    appBar: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226,232,240,0.5)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    appBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        padding: 8,
        borderRadius: 100,
    },
    appBarTitle: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 20,
        color: AdminColors.primaryContainer,
        letterSpacing: -0.5,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
        gap: 8,
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
