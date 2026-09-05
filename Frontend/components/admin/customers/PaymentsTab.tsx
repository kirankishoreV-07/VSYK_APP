import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { ChitMember, Transaction, PaymentSchedule } from './types';
import { formatPaise, formatDateIST, isOverdue } from './utils';

interface PaymentsTabProps {
    memberships: ChitMember[];
    transactions: Transaction[];
    schedules: PaymentSchedule[];
}

export function PaymentsTab({ memberships, transactions, schedules = [] }: PaymentsTabProps) {
    const [filterGroup, setFilterGroup] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Calculate summary metrics
    const summary = useMemo(() => {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const paidThisYear = transactions
            .filter(t => {
                const txDate = new Date(t.transaction_date);
                return t.status === 'completed' &&
                    t.payment_type === 'installment' &&
                    txDate >= yearStart;
            })
            .reduce((sum, t) => sum + t.amount, 0);

        const pendingNow = (schedules || [])
            .filter(s => !s.paid)
            .reduce((sum, s) => {
                const paid = transactions
                    .filter(tx => tx.chit_member_id === s.chit_member_id && tx.status === 'completed')
                    .reduce((tSum, tx) => tSum + tx.amount, 0);
                return sum + Math.max(0, s.amount - paid);
            }, 0);

        const overdueCount = (schedules || []).filter(s => {
            if (s.paid) return false;
            return isOverdue(s.due_date, false);
        }).length;

        const failedLast30Days = transactions.filter(t => {
            const txDate = new Date(t.transaction_date);
            return t.status === 'failed' && txDate >= thirtyDaysAgo;
        }).length;

        return { paidThisYear, pendingNow, overdueCount, failedLast30Days };
    }, [transactions, schedules]);

    // Get recent transactions (last 90 days)
    const recentTransactions = useMemo(() => {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        return transactions
            .filter(t => {
                const txDate = new Date(t.transaction_date);
                if (txDate < ninetyDaysAgo) return false;
                if (filterGroup !== 'all') {
                    const membership = memberships.find(m => m.id === t.chit_member_id);
                    if (membership?.chit_group_id !== filterGroup) return false;
                }
                if (filterStatus !== 'all' && t.status !== filterStatus) return false;
                return true;
            })
            .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
            .slice(0, 50);
    }, [transactions, memberships, filterGroup, filterStatus]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Summary Strip */}
            <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>PAID THIS YEAR</Text>
                    <Text style={styles.summaryValue}>{formatPaise(summary.paidThisYear)}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>PENDING NOW</Text>
                    <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{formatPaise(summary.pendingNow)}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>OVERDUE</Text>
                    <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{summary.overdueCount}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>FAILED (30D)</Text>
                    <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{summary.failedLast30Days}</Text>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.filtersSection}>
                <Text style={styles.filtersLabel}>Filter by Group:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                    <TouchableOpacity
                        style={[styles.filterChip, filterGroup === 'all' && styles.filterChipActive]}
                        onPress={() => setFilterGroup('all')}
                    >
                        <Text style={[styles.filterChipText, filterGroup === 'all' && styles.filterChipTextActive]}>
                            All Groups
                        </Text>
                    </TouchableOpacity>
                    {memberships.map(m => (
                        <TouchableOpacity
                            key={m.id}
                            style={[styles.filterChip, filterGroup === m.chit_group_id && styles.filterChipActive]}
                            onPress={() => setFilterGroup(m.chit_group_id)}
                        >
                            <Text style={[styles.filterChipText, filterGroup === m.chit_group_id && styles.filterChipTextActive]}>
                                {m.chit_groups.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.filtersSection}>
                <Text style={styles.filtersLabel}>Filter by Status:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                    {['all', 'completed', 'pending', 'failed'].map(status => (
                        <TouchableOpacity
                            key={status}
                            style={[styles.filterChip, filterStatus === status && styles.filterChipActive]}
                            onPress={() => setFilterStatus(status)}
                        >
                            <Text style={[styles.filterChipText, filterStatus === status && styles.filterChipTextActive]}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Transactions Table */}
            <Text style={styles.sectionTitle}>Recent Transactions (Last 90 Days)</Text>

            {recentTransactions.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No transactions found matching your filters</Text>
                </View>
            ) : (
                recentTransactions.map(tx => {
                    const membership = memberships.find(m => m.id === tx.chit_member_id);
                    const statusColor = tx.status === 'completed' ? '#10B981' :
                        tx.status === 'failed' ? '#EF4444' : '#F59E0B';

                    return (
                        <View key={tx.id} style={styles.txCard}>
                            <View style={styles.txHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.txGroup}>{membership?.chit_groups.name || 'Unknown Group'}</Text>
                                    <Text style={styles.txType}>{tx.payment_type.toUpperCase()}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.txAmount}>{formatPaise(tx.amount)}</Text>
                                    <Text style={[styles.txStatus, { color: statusColor }]}>
                                        {tx.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.txFooter}>
                                <Text style={styles.txDate}>{formatDateIST(tx.transaction_date)}</Text>
                                {tx.notes && (
                                    <Text style={styles.txNotes} numberOfLines={1}>{tx.notes}</Text>
                                )}
                            </View>
                        </View>
                    );
                })
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
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    summaryLabel: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 10,
        color: '#94A3B8',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    summaryValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 20,
        color: '#0B1C30',
    },
    filtersSection: {
        marginBottom: 16,
    },
    filtersLabel: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: '#64748B',
        marginBottom: 8,
    },
    filtersScroll: {
        flexGrow: 0,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#005E7D',
        borderColor: '#005E7D',
    },
    filterChipText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: '#64748B',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    sectionTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 12,
    },
    txCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    txHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    txGroup: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: '#0B1C30',
    },
    txType: {
        fontFamily: 'Inter_500Medium',
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    txAmount: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 16,
        color: '#0B1C30',
    },
    txStatus: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 10,
        marginTop: 2,
    },
    txFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    txDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
    },
    txNotes: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        color: '#94A3B8',
        fontStyle: 'italic',
        flex: 1,
        marginLeft: 12,
    },
    emptyCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    emptyText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
    },
});
