import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { ChitMember, Transaction, Auction, PaymentSchedule } from './types';
import { formatPaise, formatDateIST, deriveRiskLevel } from './utils';

interface OverviewTabProps {
    memberships: ChitMember[];
    transactions: Transaction[];
    schedules: PaymentSchedule[];
    auctions: Auction[];
    overdueCount: number;
    onTimePercentage: number;
    outstanding: number;
    onViewAllTransactions: () => void;
}

export function OverviewTab({
    memberships,
    transactions,
    schedules,
    auctions,
    overdueCount,
    onTimePercentage,
    outstanding,
    onViewAllTransactions,
}: OverviewTabProps) {
    const riskLevel = deriveRiskLevel(overdueCount, onTimePercentage);

    // Get active groups
    const activeGroups = memberships.filter(
        (m) => m.bid_status === 'active' || m.bid_status === 'bidding'
    );

    // Get upcoming dues (next 30 days)
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingDues = schedules
        .filter((s) => {
            if (s.paid) return false;
            const dueDate = new Date(s.due_date);
            return dueDate >= now && dueDate <= thirtyDaysLater;
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5);

    // Get last 5 transactions
    const recentTransactions = transactions.slice(0, 5);

    // Get most recent auction outcome
    const recentAuction = auctions
        .filter((a) => a.status === 'completed')
        .sort((a, b) => new Date(b.ended_at || b.scheduled_at).getTime() - new Date(a.ended_at || a.scheduled_at).getTime())[0];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Health Snapshot */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Health Snapshot</Text>
                <View style={styles.healthRow}>
                    <View style={styles.healthItem}>
                        <Text style={styles.healthLabel}>Risk Level</Text>
                        <Text
                            style={[
                                styles.healthValue,
                                {
                                    color:
                                        riskLevel === 'low' ? '#10B981' : riskLevel === 'medium' ? '#F59E0B' : '#EF4444',
                                },
                            ]}
                        >
                            {riskLevel.toUpperCase()}
                        </Text>
                        <Text style={styles.healthNote}>(Derived)</Text>
                    </View>
                    <View style={styles.healthItem}>
                        <Text style={styles.healthLabel}>Overdue Payments</Text>
                        <Text style={[styles.healthValue, { color: overdueCount > 0 ? '#EF4444' : '#10B981' }]}>
                            {overdueCount}
                        </Text>
                    </View>
                    <View style={styles.healthItem}>
                        <Text style={styles.healthLabel}>Outstanding</Text>
                        <Text style={[styles.healthValue, { fontSize: 16 }]}>{formatPaise(outstanding)}</Text>
                    </View>
                </View>
            </View>

            {/* Upcoming Dues */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Upcoming Dues (Next 30 Days)</Text>
                {upcomingDues.length === 0 ? (
                    <Text style={styles.emptyText}>No upcoming dues in the next 30 days</Text>
                ) : (
                    upcomingDues.map((schedule) => {
                        const membership = memberships.find((m) => m.id === schedule.chit_member_id);
                        return (
                            <View key={schedule.id} style={styles.dueRow}>
                                <View style={styles.dueLeft}>
                                    <Text style={styles.dueGroup}>{membership?.chit_groups?.name || 'Unknown'}</Text>
                                    <Text style={styles.dueMeta}>Month {schedule.month_number}</Text>
                                </View>
                                <View style={styles.dueRight}>
                                    <Text style={styles.dueAmount}>{formatPaise(schedule.amount)}</Text>
                                    <Text style={styles.dueDate}>{formatDateIST(schedule.due_date)}</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Recent Transactions */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Recent Transactions</Text>
                    <TouchableOpacity onPress={onViewAllTransactions}>
                        <Text style={styles.viewAllLink}>View all →</Text>
                    </TouchableOpacity>
                </View>
                {recentTransactions.length === 0 ? (
                    <Text style={styles.emptyText}>No transactions yet</Text>
                ) : (
                    recentTransactions.map((tx) => {
                        const membership = memberships.find((m) => m.id === tx.chit_member_id);
                        return (
                            <View key={tx.id} style={styles.txRow}>
                                <View style={styles.txLeft}>
                                    <Text style={styles.txType}>{tx.payment_type.toUpperCase()}</Text>
                                    <Text style={styles.txMeta}>
                                        {membership?.chit_groups?.name || 'Unknown'} • {formatDateIST(tx.transaction_date)}
                                    </Text>
                                </View>
                                <View style={styles.txRight}>
                                    <Text style={styles.txAmount}>{formatPaise(tx.amount)}</Text>
                                    <Text
                                        style={[
                                            styles.txStatus,
                                            { color: tx.status === 'completed' ? '#10B981' : '#EF4444' },
                                        ]}
                                    >
                                        {tx.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Active Groups */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Active Groups ({activeGroups.length})</Text>
                {activeGroups.length === 0 ? (
                    <Text style={styles.emptyText}>No active groups</Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupScroll}>
                        {activeGroups.slice(0, 3).map((membership) => (
                            <View key={membership.id} style={styles.groupCard}>
                                <Text style={styles.groupName}>{membership.chit_groups.name}</Text>
                                <Text style={styles.groupMeta}>
                                    Month {membership.current_month} / {membership.chit_groups.duration_months}
                                </Text>
                                <Text style={styles.groupValue}>{formatPaise(membership.chit_groups.value)}</Text>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        {
                                            backgroundColor:
                                                membership.bid_status === 'active' ? '#DCFCE7' : '#FEF3C7',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            {
                                                color: membership.bid_status === 'active' ? '#16A34A' : '#B45309',
                                            },
                                        ]}
                                    >
                                        {membership.bid_status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Most Recent Auction Outcome */}
            {recentAuction && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Most Recent Auction Outcome</Text>
                    <View style={styles.auctionCard}>
                        <Text style={styles.auctionGroup}>
                            {memberships.find((m) => m.chit_group_id === recentAuction.chit_group_id)?.chit_groups?.name || 'Unknown'}
                        </Text>
                        <Text style={styles.auctionMeta}>
                            Cycle {recentAuction.auction_number} • {formatDateIST(recentAuction.ended_at || recentAuction.scheduled_at)}
                        </Text>
                        {recentAuction.winner_name && (
                            <Text style={styles.auctionWinner}>Winner: {recentAuction.winner_name}</Text>
                        )}
                        {recentAuction.winner_prize_amount && (
                            <Text style={styles.auctionPrize}>Prize: {formatPaise(recentAuction.winner_prize_amount)}</Text>
                        )}
                        {recentAuction.discount_amount && (
                            <Text style={styles.auctionDiscount}>Discount: {formatPaise(recentAuction.discount_amount)}</Text>
                        )}
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    viewAllLink: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: '#0EA5E9',
    },
    healthRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    healthItem: {
        alignItems: 'center',
    },
    healthLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 11,
        color: '#64748B',
        marginBottom: 4,
    },
    healthValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 20,
        color: '#0B1C30',
    },
    healthNote: {
        fontFamily: 'Inter_400Regular',
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2,
    },
    emptyText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        paddingVertical: 20,
    },
    dueRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    dueLeft: {
        flex: 1,
    },
    dueGroup: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: '#0B1C30',
    },
    dueMeta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    dueRight: {
        alignItems: 'flex-end',
    },
    dueAmount: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 14,
        color: '#0B1C30',
    },
    dueDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    txRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    txLeft: {
        flex: 1,
    },
    txType: {
        fontFamily: 'Inter_700Bold',
        fontSize: 12,
        color: '#0EA5E9',
    },
    txMeta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    txRight: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 14,
        color: '#0B1C30',
    },
    txStatus: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 10,
        marginTop: 2,
    },
    groupScroll: {
        gap: 12,
    },
    groupCard: {
        width: 180,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    groupName: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: '#0B1C30',
        marginBottom: 4,
    },
    groupMeta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        marginBottom: 8,
    },
    groupValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 16,
        color: '#0EA5E9',
        marginBottom: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    statusText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 10,
    },
    auctionCard: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
    },
    auctionGroup: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: '#0B1C30',
        marginBottom: 4,
    },
    auctionMeta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        marginBottom: 8,
    },
    auctionWinner: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: '#7C3AED',
        marginBottom: 4,
    },
    auctionPrize: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 13,
        color: '#10B981',
        marginBottom: 4,
    },
    auctionDiscount: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 13,
        color: '#F59E0B',
    },
});
