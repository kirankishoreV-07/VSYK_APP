import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ChitMember, Transaction, PaymentSchedule, Auction, CashCollection, AuctionPrizeSettlement } from './types';
import { formatPaise, formatPaiseCompact, formatDateIST, formatDueShort } from './utils';
import { AdminColors, softElevation } from './adminStyles';
import { computeCustomerUpcomingDues } from '../../../../lib/memberGroupHistory';

type DueFilter = 'all' | 'overdue' | 'partial' | 'pending';

interface OverviewTabProps {
    memberships: ChitMember[];
    transactions: Transaction[];
    schedules: PaymentSchedule[];
    auctions: Auction[];
    cashCollections: CashCollection[];
    onViewAllTransactions: () => void;
    onViewGroupPayments?: () => void;
}

function getPaymentMethodLabel(tx: Transaction): string {
    const notes = (tx.notes || '').toLowerCase();
    if (notes.includes('upi')) return 'UPI Payment';
    if (notes.includes('cash')) return 'Cash Payment';
    if (notes.includes('bank')) return 'Bank Transfer';
    return 'Online Payment';
}

function getDueStatusLabel(status: 'partial' | 'pending' | 'overdue'): string {
    if (status === 'overdue') return 'OVERDUE';
    if (status === 'partial') return 'PARTIAL';
    return 'DUE';
}

function getDueStatusStyles(status: 'partial' | 'pending' | 'overdue') {
    if (status === 'overdue') {
        return {
            pill: styles.dueStatusPillOverdue,
            text: styles.dueStatusTextOverdue,
            row: styles.dueRowOverdue,
        };
    }
    if (status === 'partial') {
        return {
            pill: styles.dueStatusPillPartial,
            text: styles.dueStatusTextPartial,
            row: styles.dueRowPartial,
        };
    }
    return {
        pill: styles.dueStatusPillPending,
        text: styles.dueStatusTextPending,
        row: null,
    };
}

const DUE_FILTERS: Array<{ key: DueFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'partial', label: 'Partial' },
    { key: 'pending', label: 'Due' },
];

export function OverviewTab({
    memberships,
    transactions,
    schedules,
    auctions,
    cashCollections,
    onViewAllTransactions,
    onViewGroupPayments,
}: OverviewTabProps) {
    const [dueFilter, setDueFilter] = useState<DueFilter>('all');
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const activeGroups = memberships.filter(
        (m) => m.bid_status === 'active' || m.bid_status === 'bidding',
    );

    const allUpcomingDues = useMemo(
        () =>
            computeCustomerUpcomingDues({
                memberships,
                schedules,
                cashCollections,
                transactions,
                auctions,
            }),
        [memberships, schedules, cashCollections, transactions, auctions],
    );

    const filteredDues = useMemo(() => {
        if (dueFilter === 'all') return allUpcomingDues;
        if (dueFilter === 'pending') return allUpcomingDues.filter((d) => d.status === 'pending');
        return allUpcomingDues.filter((d) => d.status === dueFilter);
    }, [allUpcomingDues, dueFilter]);

    const groupedDues = useMemo(() => {
        const groups = new Map<
            string,
            {
                membershipId: string;
                groupName: string;
                ticketNumber: string | null;
                dues: typeof filteredDues;
            }
        >();

        for (const due of filteredDues) {
            const existing = groups.get(due.membershipId);
            if (existing) {
                existing.dues.push(due);
            } else {
                groups.set(due.membershipId, {
                    membershipId: due.membershipId,
                    groupName: due.groupName,
                    ticketNumber: due.ticketNumber ?? null,
                    dues: [due],
                });
            }
        }

        return Array.from(groups.values()).sort((a, b) => {
            const aTotal = a.dues.reduce((sum, d) => sum + d.amountDue, 0);
            const bTotal = b.dues.reduce((sum, d) => sum + d.amountDue, 0);
            return bTotal - aTotal;
        });
    }, [filteredDues]);

    const dueSummary = useMemo(() => {
        const totalOutstanding = allUpcomingDues.reduce((sum, d) => sum + d.amountDue, 0);
        const overdueCount = allUpcomingDues.filter((d) => d.status === 'overdue').length;
        const partialCount = allUpcomingDues.filter((d) => d.status === 'partial').length;
        return {
            totalOutstanding,
            overdueCount,
            partialCount,
            totalCount: allUpcomingDues.length,
            groupCount: new Set(allUpcomingDues.map((d) => d.membershipId)).size,
        };
    }, [allUpcomingDues]);

    const filterCounts = useMemo(
        () => ({
            all: allUpcomingDues.length,
            overdue: allUpcomingDues.filter((d) => d.status === 'overdue').length,
            partial: allUpcomingDues.filter((d) => d.status === 'partial').length,
            pending: allUpcomingDues.filter((d) => d.status === 'pending').length,
        }),
        [allUpcomingDues],
    );

    const toggleGroup = (membershipId: string) => {
        setCollapsedGroups((prev) => ({
            ...prev,
            [membershipId]: !prev[membershipId],
        }));
    };

    const recentTransactions = [
        ...transactions
            .filter((t) => t.status === 'completed' || t.status === 'success')
            .map((t) => ({
                id: t.id,
                chit_member_id: t.chit_member_id,
                amount: t.amount,
                transaction_date: t.transaction_date,
                notes: t.notes,
                kind: 'transaction' as const,
            })),
        ...cashCollections.map((c) => ({
            id: c.id,
            chit_member_id: c.chit_member_id,
            amount: c.amount,
            transaction_date: c.recorded_at,
            notes: `Cash · Month ${c.month_number}`,
            kind: 'cash' as const,
        })),
    ]
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
        .slice(0, 5);

    return (
        <View style={styles.container}>
            <View style={styles.duesCard}>
                <View style={styles.duesCardHeader}>
                    <View>
                        <Text style={styles.sectionTitleInline}>Upcoming Dues</Text>
                        <Text style={styles.duesSubtitle}>
                            {dueSummary.totalCount} installment{dueSummary.totalCount === 1 ? '' : 's'} across{' '}
                            {dueSummary.groupCount} group{dueSummary.groupCount === 1 ? '' : 's'}
                        </Text>
                    </View>
                    {onViewGroupPayments && dueSummary.totalCount > 0 && (
                        <TouchableOpacity style={styles.duesManageBtn} onPress={onViewGroupPayments}>
                            <Text style={styles.duesManageBtnText}>COLLECT</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {dueSummary.totalCount > 0 && (
                    <View style={styles.duesSummaryBar}>
                        <View style={styles.duesSummaryMain}>
                            <Text style={styles.duesSummaryLabel}>TOTAL OUTSTANDING</Text>
                            <Text style={styles.duesSummaryValue}>
                                {formatPaise(dueSummary.totalOutstanding)}
                            </Text>
                        </View>
                        <View style={styles.duesSummaryMeta}>
                            {dueSummary.overdueCount > 0 && (
                                <View style={styles.duesSummaryChipOverdue}>
                                    <Text style={styles.duesSummaryChipTextOverdue}>
                                        {dueSummary.overdueCount} overdue
                                    </Text>
                                </View>
                            )}
                            {dueSummary.partialCount > 0 && (
                                <View style={styles.duesSummaryChipPartial}>
                                    <Text style={styles.duesSummaryChipTextPartial}>
                                        {dueSummary.partialCount} partial
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {dueSummary.totalCount > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dueFilterRow}
                    >
                        {DUE_FILTERS.map((filter) => {
                            const count = filterCounts[filter.key];
                            const isActive = dueFilter === filter.key;
                            return (
                                <TouchableOpacity
                                    key={filter.key}
                                    style={[styles.dueFilterChip, isActive && styles.dueFilterChipActive]}
                                    onPress={() => setDueFilter(filter.key)}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.dueFilterChipText,
                                            isActive && styles.dueFilterChipTextActive,
                                        ]}
                                    >
                                        {filter.label}
                                    </Text>
                                    <View style={[styles.dueFilterCount, isActive && styles.dueFilterCountActive]}>
                                        <Text
                                            style={[
                                                styles.dueFilterCountText,
                                                isActive && styles.dueFilterCountTextActive,
                                            ]}
                                        >
                                            {count}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {allUpcomingDues.length === 0 ? (
                    <Text style={styles.emptyText}>No upcoming dues</Text>
                ) : filteredDues.length === 0 ? (
                    <Text style={styles.emptyText}>No dues match this filter</Text>
                ) : (
                    <View style={styles.duesGroupList}>
                        {groupedDues.map((group) => {
                            const isCollapsed = collapsedGroups[group.membershipId];
                            const groupTotal = group.dues.reduce((sum, d) => sum + d.amountDue, 0);

                            return (
                                <View key={group.membershipId} style={styles.duesGroupBlock}>
                                    <TouchableOpacity
                                        style={styles.duesGroupHeader}
                                        onPress={() => toggleGroup(group.membershipId)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={styles.duesGroupHeaderLeft}>
                                            <Text style={styles.duesGroupName}>{group.groupName}</Text>
                                            <Text style={styles.duesGroupMeta}>
                                                {group.ticketNumber ? `Ticket #${group.ticketNumber} · ` : ''}
                                                {group.dues.length} due{group.dues.length === 1 ? '' : 's'}
                                            </Text>
                                        </View>
                                        <View style={styles.duesGroupHeaderRight}>
                                            <Text style={styles.duesGroupTotal}>{formatPaise(groupTotal)}</Text>
                                            <Svg
                                                width={18}
                                                height={18}
                                                viewBox="0 0 24 24"
                                                fill={AdminColors.slate400}
                                                style={{
                                                    transform: [{ rotate: isCollapsed ? '0deg' : '180deg' }],
                                                }}
                                            >
                                                <Path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                                            </Svg>
                                        </View>
                                    </TouchableOpacity>

                                    {!isCollapsed && (
                                        <View style={styles.duesRows}>
                                            {group.dues.map((due) => {
                                                const statusStyles = getDueStatusStyles(due.status);
                                                return (
                                                    <View
                                                        key={due.id}
                                                        style={[styles.dueRow, statusStyles.row]}
                                                    >
                                                        <View style={styles.dueMonthBadge}>
                                                            <Text style={styles.dueMonthBadgeLabel}>M</Text>
                                                            <Text style={styles.dueMonthBadgeNum}>
                                                                {due.monthNumber}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.dueRowBody}>
                                                            <View style={styles.dueRowTop}>
                                                                <Text style={styles.dueRowDate}>
                                                                    Due {formatDueShort(due.dueDate)}
                                                                </Text>
                                                                <Text style={styles.dueRowAmount}>
                                                                    {formatPaise(due.amountDue)}
                                                                </Text>
                                                            </View>
                                                            <View style={styles.dueRowBottom}>
                                                                <Text style={styles.dueRowSub}>
                                                                    {due.status === 'partial'
                                                                        ? `${formatPaise(due.paidAmount)} paid · ${formatPaise(due.amountDue)} left of ${formatPaise(due.fullDueAmount)}`
                                                                        : `Installment ${due.monthNumber} · ${formatPaise(due.fullDueAmount)} payable`}
                                                                </Text>
                                                                <View
                                                                    style={[
                                                                        styles.dueStatusPill,
                                                                        statusStyles.pill,
                                                                    ]}
                                                                >
                                                                    <Text
                                                                        style={[
                                                                            styles.dueStatusText,
                                                                            statusStyles.text,
                                                                        ]}
                                                                    >
                                                                        {getDueStatusLabel(due.status)}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>

            <View style={styles.activeGroupsSection}>
                <Text style={styles.sectionTitleLoose}>Active Groups</Text>
                {activeGroups.length === 0 ? (
                    <Text style={styles.emptyText}>No active groups</Text>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.groupScroll}
                    >
                        {activeGroups.map((membership) => {
                            const group = membership.chit_groups;
                            const memberSchedules = schedules.filter((s) => s.chit_member_id === membership.id);
                            const memberCash = cashCollections.filter((c) => c.chit_member_id === membership.id);
                            const totalContribution =
                                group.accounting_type === 'unaccounted'
                                    ? memberCash.reduce((sum, c) => sum + c.amount, 0)
                                    : transactions
                                          .filter(
                                              (t) =>
                                                  t.chit_member_id === membership.id &&
                                                  t.status === 'completed' &&
                                                  t.payment_type === 'installment',
                                          )
                                          .reduce((sum, t) => sum + t.amount, 0);
                            const dividendsEarned = memberSchedules
                                .filter((s) => s.paid)
                                .reduce((sum, s) => sum + s.dividend_amount, 0);
                            const progress =
                                group.duration_months > 0
                                    ? Math.round((membership.current_month / group.duration_months) * 100)
                                    : 0;
                            const isNearComplete = progress >= 90;

                            return (
                                <View key={membership.id} style={styles.groupCard}>
                                    <View style={styles.groupCardAccent} />
                                    <Text style={styles.groupCardLabel}>{group.name}</Text>
                                    <Text style={styles.groupCardValue}>{formatPaise(group.value)}</Text>
                                    <View style={styles.progressRow}>
                                        <Text style={styles.progressLabel}>Cycle Progress</Text>
                                        <Text style={styles.progressValue}>
                                            {membership.current_month}/{group.duration_months} months
                                        </Text>
                                    </View>
                                    <View style={styles.progressBar}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    width: `${Math.min(100, progress)}%`,
                                                    backgroundColor: isNearComplete
                                                        ? AdminColors.secondary
                                                        : AdminColors.primary,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <View style={styles.groupStats}>
                                        <View>
                                            <Text style={styles.statLabel}>Total Contribution</Text>
                                            <Text style={styles.statValue}>{formatPaiseCompact(totalContribution)}</Text>
                                        </View>
                                        <View style={styles.statRight}>
                                            <Text style={styles.statLabel}>Dividends Earned</Text>
                                            <Text style={[styles.statValue, { color: AdminColors.secondary }]}>
                                                {formatPaiseCompact(dividendsEarned)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    <TouchableOpacity onPress={onViewAllTransactions}>
                        <Text style={styles.viewAllLink}>VIEW ALL</Text>
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
                                    <View style={styles.txIcon}>
                                        <Svg width={20} height={20} viewBox="0 0 24 24" fill={AdminColors.primary}>
                                            <Path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zM4 10h16v2H4z" />
                                        </Svg>
                                    </View>
                                    <View>
                                        <Text style={styles.txGroup}>
                                            {membership?.chit_groups?.name || 'Unknown'}
                                        </Text>
                                        <Text style={styles.txMeta}>
                                            {tx.kind === 'cash'
                                                ? 'Cash Payment'
                                                : getPaymentMethodLabel({
                                                      ...tx,
                                                      payment_type: 'installment',
                                                      status: 'completed',
                                                      auction_id: null,
                                                  } as Transaction)}{' '}
                                            • {formatDateIST(tx.transaction_date)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.txRight}>
                                    <Text style={styles.txAmount}>+ {formatPaise(tx.amount)}</Text>
                                    <Text style={styles.txStatus}>SUCCESS</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 32,
        gap: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        ...softElevation,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 18,
        color: AdminColors.textPrimary,
        marginBottom: 16,
    },
    sectionTitleLoose: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 18,
        color: AdminColors.textPrimary,
        paddingHorizontal: 4,
        marginBottom: 12,
    },
    activeGroupsSection: {
        gap: 4,
    },
    emptyText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        color: AdminColors.slate400,
        textAlign: 'center',
        paddingVertical: 16,
    },
    duesCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        ...softElevation,
    },
    duesCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
        gap: 12,
    },
    sectionTitleInline: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 18,
        color: AdminColors.textPrimary,
    },
    duesSubtitle: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: AdminColors.slate500,
        marginTop: 4,
    },
    duesManageBtn: {
        backgroundColor: AdminColors.primaryContainer,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 100,
    },
    duesManageBtnText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    duesSummaryBar: {
        backgroundColor: '#F0F9FF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        padding: 14,
        marginBottom: 14,
        gap: 10,
    },
    duesSummaryMain: {
        gap: 4,
    },
    duesSummaryLabel: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: '#005E7D',
        letterSpacing: 1,
    },
    duesSummaryValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 26,
        color: AdminColors.primaryContainer,
        letterSpacing: -0.5,
    },
    duesSummaryMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    duesSummaryChipOverdue: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    duesSummaryChipTextOverdue: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: '#B91C1C',
    },
    duesSummaryChipPartial: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    duesSummaryChipTextPartial: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: '#B45309',
    },
    dueFilterRow: {
        gap: 8,
        paddingBottom: 14,
    },
    dueFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 100,
        backgroundColor: AdminColors.bgSecondary,
        borderWidth: 1,
        borderColor: AdminColors.slate200,
    },
    dueFilterChipActive: {
        backgroundColor: AdminColors.primaryContainer,
        borderColor: AdminColors.primaryContainer,
    },
    dueFilterChipText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: AdminColors.slate500,
    },
    dueFilterChipTextActive: {
        color: '#FFFFFF',
    },
    dueFilterCount: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    dueFilterCountActive: {
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    dueFilterCountText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: AdminColors.slate500,
    },
    dueFilterCountTextActive: {
        color: '#FFFFFF',
    },
    duesGroupList: {
        gap: 12,
    },
    duesGroupBlock: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        overflow: 'hidden',
        backgroundColor: AdminColors.bgSecondary,
    },
    duesGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: AdminColors.slate100,
    },
    duesGroupHeaderLeft: {
        flex: 1,
        paddingRight: 10,
    },
    duesGroupHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    duesGroupName: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: AdminColors.textPrimary,
    },
    duesGroupMeta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        color: AdminColors.slate500,
        marginTop: 2,
    },
    duesGroupTotal: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 15,
        color: AdminColors.primaryContainer,
    },
    duesRows: {
        padding: 10,
        gap: 8,
    },
    dueRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        padding: 12,
    },
    dueRowPartial: {
        borderColor: '#FDE68A',
        backgroundColor: '#FFFBEB',
    },
    dueRowOverdue: {
        borderColor: '#FECACA',
        backgroundColor: '#FEF2F2',
    },
    dueMonthBadge: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dueMonthBadgeLabel: {
        fontFamily: 'Inter_700Bold',
        fontSize: 8,
        color: '#005E7D',
        letterSpacing: 0.5,
    },
    dueMonthBadgeNum: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 15,
        color: AdminColors.primaryContainer,
        marginTop: -2,
    },
    dueRowBody: {
        flex: 1,
        gap: 6,
    },
    dueRowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    dueRowDate: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: AdminColors.textPrimary,
    },
    dueRowAmount: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 16,
        color: AdminColors.textPrimary,
    },
    dueRowBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 8,
    },
    dueRowSub: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        color: AdminColors.slate500,
        flex: 1,
        lineHeight: 15,
    },
    dueStatusPill: {
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        flexShrink: 0,
    },
    dueStatusPillPending: {
        backgroundColor: '#E0F2FE',
    },
    dueStatusPillPartial: {
        backgroundColor: '#FEF3C7',
    },
    dueStatusPillOverdue: {
        backgroundColor: '#FEE2E2',
    },
    dueStatusText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 9,
        color: '#005E7D',
        letterSpacing: 0.5,
    },
    dueStatusTextPending: {
        color: '#005E7D',
    },
    dueStatusTextPartial: {
        color: '#B45309',
    },
    dueStatusTextOverdue: {
        color: '#B91C1C',
    },
    groupScroll: {
        gap: 12,
        paddingBottom: 8,
    },
    groupCard: {
        width: 300,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        overflow: 'hidden',
        ...softElevation,
    },
    groupCardAccent: {
        position: 'absolute',
        top: -64,
        right: -64,
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: AdminColors.cyan50,
    },
    groupCardLabel: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: AdminColors.primaryContainer,
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    groupCardValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 24,
        color: AdminColors.textPrimary,
        marginBottom: 16,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    progressLabel: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: AdminColors.slate500,
    },
    progressValue: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: AdminColors.textPrimary,
    },
    progressBar: {
        height: 8,
        backgroundColor: AdminColors.slate100,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    groupStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
    },
    statLabel: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: AdminColors.slate400,
        marginBottom: 2,
    },
    statValue: {
        fontFamily: 'Inter_700Bold',
        fontSize: 12,
        color: AdminColors.textPrimary,
    },
    statRight: {
        alignItems: 'flex-end',
    },
    viewAllLink: {
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
        color: AdminColors.primary,
        letterSpacing: 1,
    },
    txRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 4,
    },
    txLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    txIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: 'rgba(0,94,125,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    txGroup: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: AdminColors.textPrimary,
    },
    txMeta: {
        fontFamily: 'Inter_500Medium',
        fontSize: 11,
        color: AdminColors.slate500,
        marginTop: 2,
    },
    txRight: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 14,
        color: '#16A34A',
    },
    txStatus: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: AdminColors.slate400,
        letterSpacing: 0.5,
        marginTop: 2,
    },
});