import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ChitMember, InnerTab, PaymentSchedule, Transaction, Auction, AuctionParticipant, CashCollection } from './types';
import { formatPaise, formatDateIST, formatDateTimeIST } from './utils';
import { supabase } from '../../../../lib/supabase';
import { RecordCashCollectionModal } from './RecordCashCollectionModal';

interface GroupsTabProps {
    memberships: ChitMember[];
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    auctions: Auction[];
    participants: AuctionParticipant[];
}

const INNER_TABS: Array<{ key: InnerTab; label: string }> = [
    { key: 'summary', label: 'Summary' },
    { key: 'payment-history', label: 'Payment History' },
    { key: 'auction-history', label: 'Auction History' },
    { key: 'documents', label: 'Documents' },
    { key: 'ledger', label: 'Ledger' },
];

export function GroupsTab({ memberships, schedules, transactions, auctions, participants }: GroupsTabProps) {
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
        memberships.length > 0 ? memberships[0].id : null
    );
    const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>('summary');
    const [cashCollections, setCashCollections] = useState<CashCollection[]>([]);
    const [cashModalVisible, setCashModalVisible] = useState(false);
    const [editingCollection, setEditingCollection] = useState<CashCollection | null>(null);

    // Filter data for selected group
    const selectedMembership = memberships.find((m) => m.id === selectedGroupId);

    // Fetch cash collections for selected membership
    useEffect(() => {
        if (!selectedGroupId) return;

        const fetchCashCollections = async () => {
            const { data, error } = await supabase
                .from('cash_collections')
                .select('*')
                .eq('chit_member_id', selectedGroupId)
                .order('month_number', { ascending: true });

            if (!error && data) {
                setCashCollections(data as CashCollection[]);
            }
        };

        fetchCashCollections();

        // Real-time subscription
        const channel = supabase
            .channel(`cash-collections-${selectedGroupId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'cash_collections',
                filter: `chit_member_id=eq.${selectedGroupId}`
            }, () => {
                fetchCashCollections();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedGroupId]);

    const groupSchedules = useMemo(() =>
        schedules.filter(s => s.chit_member_id === selectedGroupId),
        [schedules, selectedGroupId]
    );

    const groupTransactions = useMemo(() =>
        transactions.filter(t => t.chit_member_id === selectedGroupId),
        [transactions, selectedGroupId]
    );

    const groupAuctions = useMemo(() =>
        auctions.filter(a => a.chit_group_id === selectedMembership?.chit_group_id),
        [auctions, selectedMembership]
    );

    // Find if customer won any auction in this group
    const wonAuction = useMemo(() =>
        groupAuctions.find(a => a.winner_member_id === selectedGroupId),
        [groupAuctions, selectedGroupId]
    );

    const groupCashCollections = useMemo(() =>
        cashCollections.filter(c => c.chit_member_id === selectedGroupId),
        [cashCollections, selectedGroupId]
    );

    const handleRecordCash = () => {
        setEditingCollection(null);
        setCashModalVisible(true);
    };

    const handleEditCashCollection = (collection: CashCollection) => {
        setEditingCollection(collection);
        setCashModalVisible(true);
    };

    const handleDeleteCashCollection = async (collection: CashCollection) => {
        Alert.alert(
            'Delete Collection Entry',
            'Delete this cash collection entry? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('cash_collections')
                            .delete()
                            .eq('id', collection.id);

                        if (error) {
                            Alert.alert('Error', 'Failed to delete collection entry.');
                        } else {
                            Alert.alert('Deleted', 'Cash collection entry removed.');
                            // Refetch will happen via real-time subscription
                        }
                    },
                },
            ]
        );
    };

    const isUnaccountedGroup = selectedMembership?.chit_groups.accounting_type === 'unaccounted';
    const allMonthsCovered = groupSchedules.length > 0 &&
        groupSchedules.every(s => {
            const cc = groupCashCollections.find(c => c.month_number === s.month_number);
            return cc && cc.amount >= s.amount;
        });

    if (memberships.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Group Memberships</Text>
                <Text style={styles.emptyText}>
                    This customer has not joined any chit groups yet.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Group Selector - Horizontal Chip Strip */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.groupSelector}
                contentContainerStyle={styles.groupSelectorContent}
            >
                {memberships.map((membership) => {
                    const isSelected = membership.id === selectedGroupId;
                    return (
                        <TouchableOpacity
                            key={membership.id}
                            style={[styles.groupChip, isSelected && styles.groupChipActive]}
                            onPress={() => setSelectedGroupId(membership.id)}
                        >
                            <Text style={[styles.groupChipName, isSelected && styles.groupChipNameActive]}>
                                {membership.chit_groups.name}
                            </Text>
                            <Text style={[styles.groupChipMeta, isSelected && styles.groupChipMetaActive]}>
                                {membership.current_month}/{membership.chit_groups.duration_months} months
                            </Text>
                            {membership.ticket_number && (
                                <Text style={[styles.groupChipTicket, isSelected && styles.groupChipTicketActive]}>
                                    #{membership.ticket_number}
                                </Text>
                            )}
                            <View
                                style={[
                                    styles.groupChipBadge,
                                    {
                                        backgroundColor: isSelected
                                            ? 'rgba(255,255,255,0.3)'
                                            : membership.bid_status === 'active'
                                                ? '#DCFCE7'
                                                : '#FEF3C7',
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.groupChipBadgeText,
                                        {
                                            color: isSelected
                                                ? '#FFFFFF'
                                                : membership.bid_status === 'active'
                                                    ? '#16A34A'
                                                    : '#B45309',
                                        },
                                    ]}
                                >
                                    {membership.bid_status.toUpperCase()}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Inner Tabs */}
            {selectedMembership && (
                <>
                    {/* Record Cash Collection Button for Unaccounted Groups */}
                    {isUnaccountedGroup && !allMonthsCovered && (
                        <View style={styles.cashButtonContainer}>
                            <TouchableOpacity
                                style={styles.recordCashBtn}
                                onPress={handleRecordCash}
                            >
                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
                                    <Path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                                </Svg>
                                <Text style={styles.recordCashBtnText}>Record Cash Collection</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.innerTabsContainer}
                        contentContainerStyle={styles.innerTabs}
                    >
                        {INNER_TABS.map((tab) => {
                            const isActive = activeInnerTab === tab.key;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[styles.innerTab, isActive && styles.innerTabActive]}
                                    onPress={() => setActiveInnerTab(tab.key)}
                                >
                                    <Text style={[styles.innerTabText, isActive && styles.innerTabTextActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Tab Content */}
                    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
                        {activeInnerTab === 'summary' && selectedMembership && (
                            <SummaryInnerTab
                                membership={selectedMembership}
                                schedules={groupSchedules}
                                transactions={groupTransactions}
                                wonAuction={wonAuction}
                                cashCollections={groupCashCollections}
                            />
                        )}
                        {activeInnerTab === 'payment-history' && selectedMembership && (
                            <PaymentHistoryInnerTab
                                membership={selectedMembership}
                                schedules={groupSchedules}
                                transactions={groupTransactions}
                                wonAuction={wonAuction}
                                cashCollections={groupCashCollections}
                                onEditCash={handleEditCashCollection}
                                onDeleteCash={handleDeleteCashCollection}
                            />
                        )}
                        {activeInnerTab === 'auction-history' && selectedMembership && (
                            <AuctionHistoryInnerTab
                                membership={selectedMembership}
                                auctions={groupAuctions}
                                participants={participants}
                            />
                        )}
                        {activeInnerTab === 'documents' && (
                            <View style={styles.placeholderCard}>
                                <Text style={styles.placeholderTitle}>Documents Module Coming Soon</Text>
                                <Text style={styles.placeholderText}>
                                    Will display KYC documents (Aadhaar, PAN), signed agreements, and nominee forms once the customer_documents table is created.
                                    {'\n\n'}
                                    Required table: customer_documents{'\n'}
                                    Required columns: id, customer_id, document_type, file_url, uploaded_at, verified_status
                                </Text>
                            </View>
                        )}
                        {activeInnerTab === 'ledger' && selectedMembership && (
                            <LedgerInnerTab
                                membership={selectedMembership}
                                schedules={groupSchedules}
                                transactions={groupTransactions}
                                auctions={groupAuctions}
                            />
                        )}
                    </ScrollView>
                </>
            )}

            {/* Record Cash Collection Modal */}
            {selectedMembership && (
                <RecordCashCollectionModal
                    visible={cashModalVisible}
                    onClose={() => {
                        setCashModalVisible(false);
                        setEditingCollection(null);
                    }}
                    membership={selectedMembership}
                    onSuccess={() => {
                        // Modal will close and real-time subscription will update the list
                    }}
                    existingCollection={editingCollection}
                />
            )}
        </View>
    );
}

// ============================================================================
// INNER TAB COMPONENTS
// ============================================================================

interface SummaryInnerTabProps {
    membership: ChitMember;
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    wonAuction?: Auction;
    cashCollections: CashCollection[];
}

function SummaryInnerTab({ membership, schedules, transactions, wonAuction, cashCollections }: SummaryInnerTabProps) {
    const group = membership.chit_groups;

    // Calculate metrics
    const totalPaid = transactions
        .filter(t => t.status === 'completed' && t.payment_type === 'installment')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalDue = schedules.reduce((sum, s) => sum + s.amount, 0);
    const outstanding = Math.max(0, totalDue - totalPaid);
    const completionPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

    // Payment timeliness
    const paidSchedules = schedules.filter(s => s.paid);
    const onTimePayments = paidSchedules.filter(s => {
        if (!s.paid_at) return false;
        return new Date(s.paid_at) <= new Date(s.due_date);
    }).length;
    const latePayments = paidSchedules.length - onTimePayments;
    const overdueCount = schedules.filter(s => {
        if (s.paid) return false;
        return new Date(s.due_date) < new Date();
    }).length;

    // Next due
    const nextDue = schedules
        .filter(s => !s.paid && new Date(s.due_date) >= new Date())
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

    return (
        <View>
            {/* Foreclosed Alert */}
            {membership.bid_status === 'foreclosed' && (
                <View style={styles.foreclosedAlert}>
                    <Text style={styles.alertIcon}>⚠️</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.alertTitle}>Group Foreclosed</Text>
                        <Text style={styles.alertText}>
                            This chit group was foreclosed. Settlement details may apply.
                        </Text>
                    </View>
                </View>
            )}

            {/* Group Info Card */}
            <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Group Details</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Group Name:</Text>
                    <Text style={styles.summaryValue}>{group.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Chit Value:</Text>
                    <Text style={styles.summaryValue}>{formatPaise(group.value)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Monthly Installment:</Text>
                    <Text style={styles.summaryValue}>{formatPaise(group.monthly_installment)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Duration:</Text>
                    <Text style={styles.summaryValue}>{group.duration_months} months</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Start Date:</Text>
                    <Text style={styles.summaryValue}>{group.start_date ? formatDateIST(group.start_date) : 'Not started'}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Status:</Text>
                    <Text style={[styles.summaryValue, { color: group.status === 'active' ? '#16A34A' : '#64748B' }]}>
                        {group.status.toUpperCase()}
                    </Text>
                </View>
                {membership.ticket_number && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Ticket Number:</Text>
                        <Text style={styles.summaryValue}>#{membership.ticket_number}</Text>
                    </View>
                )}
            </View>

            {/* Member Progress */}
            <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Member Progress</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Current Month:</Text>
                    <Text style={styles.summaryValue}>{membership.current_month} / {group.duration_months}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Bid Status:</Text>
                    <Text style={[styles.summaryValue, { color: membership.bid_status === 'active' ? '#16A34A' : '#F59E0B' }]}>
                        {membership.bid_status.toUpperCase()}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Completion:</Text>
                    <Text style={styles.summaryValue}>{completionPercentage}%</Text>
                </View>
            </View>

            {/* Payment Summary */}
            <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Payment Summary</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Paid:</Text>
                    <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{formatPaise(totalPaid)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Due:</Text>
                    <Text style={styles.summaryValue}>{formatPaise(totalDue)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Outstanding:</Text>
                    <Text style={[styles.summaryValue, { color: outstanding > 0 ? '#EF4444' : '#16A34A' }]}>
                        {formatPaise(outstanding)}
                    </Text>
                </View>
            </View>

            {/* Payment Stats */}
            <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Payment Statistics</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>On-Time Payments:</Text>
                    <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{onTimePayments}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Late Payments:</Text>
                    <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{latePayments}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Overdue Payments:</Text>
                    <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{overdueCount}</Text>
                </View>
            </View>

            {/* Next Due */}
            {nextDue && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardTitle}>Next Due Payment</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Month:</Text>
                        <Text style={styles.summaryValue}>{nextDue.month_number}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Due Date:</Text>
                        <Text style={styles.summaryValue}>{formatDateIST(nextDue.due_date)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Amount:</Text>
                        <Text style={[styles.summaryValue, { color: '#0EA5E9' }]}>{formatPaise(nextDue.amount)}</Text>
                    </View>
                    {nextDue.dividend_amount > 0 && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Dividend Applied:</Text>
                            <Text style={[styles.summaryValue, { color: '#10B981' }]}>{formatPaise(nextDue.dividend_amount)}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Won Auction Info */}
            {wonAuction && (
                <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE047' }]}>
                    <Text style={[styles.summaryCardTitle, { color: '#92400E' }]}>🏆 Auction Won</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Cycle:</Text>
                        <Text style={styles.summaryValue}>{wonAuction.auction_number}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Prize Amount:</Text>
                        <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{formatPaise(wonAuction.winner_prize_amount || 0)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Date Won:</Text>
                        <Text style={styles.summaryValue}>{formatDateIST(wonAuction.ended_at || wonAuction.scheduled_at)}</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

interface PaymentHistoryInnerTabProps {
    membership: ChitMember;
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    wonAuction?: Auction;
    cashCollections: CashCollection[];
    onEditCash: (collection: CashCollection) => void;
    onDeleteCash: (collection: CashCollection) => void;
}

function PaymentHistoryInnerTab({ membership, schedules, transactions, wonAuction, cashCollections, onEditCash, onDeleteCash }: PaymentHistoryInnerTabProps) {
    const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

    const wonMonth = wonAuction?.auction_number || null;
    const isUnaccounted = membership.chit_groups.accounting_type === 'unaccounted';

    // Build payment rows
    const paymentRows = schedules
        .sort((a, b) => a.month_number - b.month_number)
        .map(schedule => {
            // For unaccounted groups, use cash collections instead of transactions
            if (isUnaccounted) {
                const cashCollection = cashCollections.find(c => c.month_number === schedule.month_number);
                const netPaid = cashCollection?.amount || 0;
                const remaining = Math.max(0, schedule.amount - netPaid);
                const status = netPaid >= schedule.amount ? 'Full' : netPaid > 0 ? 'Partial' : 'Unpaid';
                const isOverdue = !cashCollection && new Date(schedule.due_date) < new Date();

                return {
                    schedule,
                    cashCollection,
                    monthTxs: [],
                    completedTxs: [],
                    failedTxs: [],
                    refundedTxs: [],
                    netPaid,
                    remaining,
                    status,
                    isOverdue,
                    isLate: false,
                    daysLate: 0,
                    isWonMonth: schedule.month_number === wonMonth,
                    isPostWin: wonMonth !== null && schedule.month_number > wonMonth,
                };
            }

            // For accounted groups, use transactions (original logic)
            const monthTxs = transactions.filter(t =>
                t.payment_type === 'installment' &&
                Math.abs(new Date(t.transaction_date).getMonth() - new Date(schedule.due_date).getMonth()) <= 1
            );

            const completedTxs = monthTxs.filter(t => t.status === 'completed' || t.status === 'success');
            const failedTxs = monthTxs.filter(t => t.status === 'failed');
            const refundedTxs = monthTxs.filter(t => t.status === 'refunded');

            const totalPaid = completedTxs.reduce((sum, t) => sum + t.amount, 0);
            const refunded = refundedTxs.reduce((sum, t) => sum + t.amount, 0);
            const netPaid = totalPaid - refunded;

            const remaining = Math.max(0, schedule.amount - netPaid);
            const status = netPaid >= schedule.amount ? 'Full' : netPaid > 0 ? 'Partial' : 'Unpaid';
            const isOverdue = !schedule.paid && new Date(schedule.due_date) < new Date();

            // Check if late
            const latestCompletedTx = completedTxs.sort((a, b) =>
                new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
            )[0];
            const isLate = latestCompletedTx && new Date(latestCompletedTx.transaction_date) > new Date(schedule.due_date);
            const daysLate = isLate ? Math.floor(
                (new Date(latestCompletedTx.transaction_date).getTime() - new Date(schedule.due_date).getTime()) / (24 * 60 * 60 * 1000)
            ) : 0;

            return {
                schedule,
                cashCollection: undefined,
                monthTxs,
                completedTxs,
                failedTxs,
                refundedTxs,
                netPaid,
                remaining,
                status,
                isOverdue,
                isLate,
                daysLate,
                isWonMonth: schedule.month_number === wonMonth,
                isPostWin: wonMonth !== null && schedule.month_number > wonMonth,
            };
        });

    return (
        <View>
            {paymentRows.map(row => (
                <View key={row.schedule.id} style={[
                    styles.paymentRow,
                    row.isOverdue && styles.paymentRowOverdue,
                    row.isWonMonth && styles.paymentRowWon,
                ]}>
                    <TouchableOpacity
                        style={styles.paymentRowHeader}
                        onPress={() => setExpandedMonth(expandedMonth === row.schedule.month_number ? null : row.schedule.month_number)}
                    >
                        <View style={styles.paymentRowLeft}>
                            <Text style={styles.paymentMonth}>Month {row.schedule.month_number}</Text>
                            {row.isWonMonth && <Text style={styles.wonBadge}>🏆 WON</Text>}
                            {row.isPostWin && <Text style={styles.postWinBadge}>Post-Win</Text>}
                            <Text style={styles.paymentDueDate}>{formatDateIST(row.schedule.due_date)}</Text>
                        </View>
                        <View style={styles.paymentRowRight}>
                            <Text style={styles.paymentAmount}>{formatPaise(row.schedule.amount)}</Text>
                            <Text style={[
                                styles.paymentStatus,
                                {
                                    color: row.status === 'Full' ? '#16A34A' :
                                        row.status === 'Partial' ? '#F59E0B' : '#64748B'
                                }
                            ]}>{row.status}</Text>
                        </View>
                    </TouchableOpacity>

                    {expandedMonth === row.schedule.month_number && (
                        <View style={styles.paymentRowExpanded}>
                            <View style={styles.paymentDetailRow}>
                                <Text style={styles.paymentDetailLabel}>Amount Due:</Text>
                                <Text style={styles.paymentDetailValue}>{formatPaise(row.schedule.amount)}</Text>
                            </View>
                            {row.schedule.dividend_amount > 0 && (
                                <View style={styles.paymentDetailRow}>
                                    <Text style={styles.paymentDetailLabel}>Dividend Applied:</Text>
                                    <Text style={[styles.paymentDetailValue, { color: '#10B981' }]}>
                                        -{formatPaise(row.schedule.dividend_amount)}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.paymentDetailRow}>
                                <Text style={styles.paymentDetailLabel}>Amount Paid:</Text>
                                <Text style={[styles.paymentDetailValue, { color: '#16A34A' }]}>
                                    {formatPaise(row.netPaid)}
                                </Text>
                            </View>
                            <View style={styles.paymentDetailRow}>
                                <Text style={styles.paymentDetailLabel}>Remaining:</Text>
                                <Text style={[styles.paymentDetailValue, { color: row.remaining > 0 ? '#EF4444' : '#16A34A' }]}>
                                    {formatPaise(row.remaining)}
                                </Text>
                            </View>

                            {row.isLate && (
                                <View style={styles.lateIndicator}>
                                    <Text style={styles.lateText}>⏰ Paid {row.daysLate} days late</Text>
                                </View>
                            )}

                            {/* Cash Collection Details (Unaccounted Groups) */}
                            {isUnaccounted && row.cashCollection && (
                                <View style={styles.cashSection}>
                                    <View style={styles.cashSectionHeader}>
                                        <Text style={styles.txSectionTitle}>💵 Cash Collection Recorded</Text>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity
                                                style={styles.editCashBtn}
                                                onPress={() => onEditCash(row.cashCollection!)}
                                            >
                                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="#01789E">
                                                    <Path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                </Svg>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.deleteCashBtn}
                                                onPress={() => onDeleteCash(row.cashCollection!)}
                                            >
                                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="#EF4444">
                                                    <Path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                </Svg>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View style={styles.txRow}>
                                        <Text style={styles.txDate}>
                                            Collected: {formatDateTimeIST(row.cashCollection.recorded_at)}
                                        </Text>
                                        <Text style={[styles.txAmount, { color: '#16A34A' }]}>
                                            {formatPaise(row.cashCollection.amount)}
                                        </Text>
                                    </View>
                                    <View style={styles.cashDenominationGrid}>
                                        {row.cashCollection.denomination_500 > 0 && (
                                            <Text style={styles.cashDenomText}>
                                                ₹500 × {row.cashCollection.denomination_500}
                                            </Text>
                                        )}
                                        {row.cashCollection.denomination_200 > 0 && (
                                            <Text style={styles.cashDenomText}>
                                                ₹200 × {row.cashCollection.denomination_200}
                                            </Text>
                                        )}
                                        {row.cashCollection.denomination_100 > 0 && (
                                            <Text style={styles.cashDenomText}>
                                                ₹100 × {row.cashCollection.denomination_100}
                                            </Text>
                                        )}
                                        {row.cashCollection.denomination_50 > 0 && (
                                            <Text style={styles.cashDenomText}>
                                                ₹50 × {row.cashCollection.denomination_50}
                                            </Text>
                                        )}
                                        {row.cashCollection.denomination_20 > 0 && (
                                            <Text style={styles.cashDenomText}>
                                                ₹20 × {row.cashCollection.denomination_20}
                                            </Text>
                                        )}
                                        {row.cashCollection.denomination_10 > 0 && (
                                            <Text style={styles.cashDenomText}>
                                                ₹10 × {row.cashCollection.denomination_10}
                                            </Text>
                                        )}
                                    </View>
                                    {row.cashCollection.notes && (
                                        <View style={styles.cashNotesBox}>
                                            <Text style={styles.cashNotesLabel}>Internal Notes:</Text>
                                            <Text style={styles.cashNotesText}>{row.cashCollection.notes}</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Transaction List (Accounted Groups) */}
                            {!isUnaccounted && row.completedTxs.length > 0 && (
                                <View style={styles.txSection}>
                                    <Text style={styles.txSectionTitle}>Completed Transactions:</Text>
                                    {row.completedTxs.map(tx => (
                                        <View key={tx.id} style={styles.txRow}>
                                            <Text style={styles.txDate}>{formatDateTimeIST(tx.transaction_date)}</Text>
                                            <Text style={styles.txAmount}>{formatPaise(tx.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {!isUnaccounted && row.failedTxs.length > 0 && (
                                <View style={styles.txSection}>
                                    <Text style={[styles.txSectionTitle, { color: '#EF4444' }]}>Failed Attempts:</Text>
                                    {row.failedTxs.map(tx => (
                                        <View key={tx.id} style={[styles.txRow, styles.txRowFailed]}>
                                            <Text style={styles.txDateFailed}>{formatDateTimeIST(tx.transaction_date)}</Text>
                                            <Text style={styles.txAmountFailed}>{formatPaise(tx.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {!isUnaccounted && row.refundedTxs.length > 0 && (
                                <View style={styles.txSection}>
                                    <Text style={[styles.txSectionTitle, { color: '#EF4444' }]}>Refunds:</Text>
                                    {row.refundedTxs.map(tx => (
                                        <View key={tx.id} style={styles.txRow}>
                                            <Text style={styles.txDate}>🔄 {formatDateTimeIST(tx.transaction_date)}</Text>
                                            <Text style={[styles.txAmount, { color: '#EF4444' }]}>-{formatPaise(tx.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </View>
            ))}

            {schedules.length === 0 && (
                <View style={styles.placeholderCard}>
                    <Text style={styles.emptyText}>No payment schedules found for this group</Text>
                </View>
            )}
        </View>
    );
}

interface AuctionHistoryInnerTabProps {
    membership: ChitMember;
    auctions: Auction[];
    participants: AuctionParticipant[];
}

function AuctionHistoryInnerTab({ membership, auctions, participants }: AuctionHistoryInnerTabProps) {
    const auctionRows = auctions
        .sort((a, b) => (b.auction_number || 0) - (a.auction_number || 0))
        .map(auction => {
            const participated = participants.some(p => p.auction_id === auction.id);
            const won = auction.winner_member_id === membership.id;

            return { auction, participated, won };
        });

    return (
        <View>
            {auctionRows.map(({ auction, participated, won }) => (
                <View key={auction.id} style={styles.auctionCard}>
                    <View style={styles.auctionHeader}>
                        <View>
                            <Text style={styles.auctionCycle}>Cycle {auction.auction_number}</Text>
                            <Text style={styles.auctionDate}>{formatDateIST(auction.ended_at || auction.scheduled_at)}</Text>
                        </View>
                        <View style={[
                            styles.auctionBadge,
                            {
                                backgroundColor: won ? '#EDE9FE' : participated ? '#CCFBF1' : '#F1F5F9',
                            }
                        ]}>
                            <Text style={[
                                styles.auctionBadgeText,
                                {
                                    color: won ? '#7C3AED' : participated ? '#0F766E' : '#64748B',
                                }
                            ]}>
                                {won ? 'WON' : participated ? 'BID' : 'NO BID'}
                            </Text>
                        </View>
                    </View>

                    {auction.status === 'completed' && (
                        <View style={styles.auctionDetails}>
                            {auction.winner_name && (
                                <View style={styles.auctionDetailRow}>
                                    <Text style={styles.auctionDetailLabel}>Winner:</Text>
                                    <Text style={styles.auctionDetailValue}>{auction.winner_name}</Text>
                                </View>
                            )}
                            {auction.winner_prize_amount !== null && (
                                <View style={styles.auctionDetailRow}>
                                    <Text style={styles.auctionDetailLabel}>Prize:</Text>
                                    <Text style={[styles.auctionDetailValue, { color: '#16A34A' }]}>
                                        {formatPaise(auction.winner_prize_amount)}
                                    </Text>
                                </View>
                            )}
                            {auction.discount_amount !== null && (
                                <View style={styles.auctionDetailRow}>
                                    <Text style={styles.auctionDetailLabel}>Discount:</Text>
                                    <Text style={[styles.auctionDetailValue, { color: '#F59E0B' }]}>
                                        {formatPaise(auction.discount_amount)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {auction.status !== 'completed' && (
                        <Text style={styles.auctionPending}>Auction {auction.status}</Text>
                    )}
                </View>
            ))}

            {auctions.length === 0 && (
                <View style={styles.placeholderCard}>
                    <Text style={styles.emptyText}>No auctions found for this group</Text>
                </View>
            )}
        </View>
    );
}

interface LedgerInnerTabProps {
    membership: ChitMember;
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    auctions: Auction[];
}

function LedgerInnerTab({ membership, schedules, transactions, auctions }: LedgerInnerTabProps) {
    interface LedgerEntry {
        date: string;
        description: string;
        debit: number;
        credit: number;
        balance: number;
        type: string;
    }

    const ledgerEntries: LedgerEntry[] = [];
    let runningBalance = 0;

    // Combine all money movements
    const movements: Array<{ date: string; desc: string; debit: number; credit: number; type: string }> = [];

    // Add installment payments as debits
    transactions
        .filter(t => t.status === 'completed' && t.payment_type === 'installment')
        .forEach(t => {
            movements.push({
                date: t.transaction_date,
                desc: `Payment for installment`,
                debit: t.amount,
                credit: 0,
                type: 'installment'
            });
        });

    // Add dividends as credits
    schedules
        .filter(s => s.paid && s.dividend_amount > 0)
        .forEach(s => {
            movements.push({
                date: s.paid_at || s.due_date,
                desc: `Dividend for Month ${s.month_number}`,
                debit: 0,
                credit: s.dividend_amount,
                type: 'dividend'
            });
        });

    // Add prize if won
    const wonAuction = auctions.find(a => a.winner_member_id === membership.id);
    if (wonAuction && wonAuction.winner_prize_amount) {
        movements.push({
            date: wonAuction.ended_at || wonAuction.scheduled_at,
            desc: `Auction Prize (Cycle ${wonAuction.auction_number})`,
            debit: 0,
            credit: wonAuction.winner_prize_amount,
            type: 'prize'
        });
    }

    // Add refunds as credits
    transactions
        .filter(t => t.status === 'refunded')
        .forEach(t => {
            movements.push({
                date: t.transaction_date,
                desc: `Refund`,
                debit: 0,
                credit: t.amount,
                type: 'refund'
            });
        });

    // Sort by date
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Build ledger entries with running balance
    movements.forEach(m => {
        runningBalance = runningBalance - m.debit + m.credit;
        ledgerEntries.push({
            date: m.date,
            description: m.desc,
            debit: m.debit,
            credit: m.credit,
            balance: runningBalance,
            type: m.type
        });
    });

    return (
        <View>
            <View style={styles.ledgerHeader}>
                <Text style={styles.ledgerHeaderText}>Date</Text>
                <Text style={styles.ledgerHeaderText}>Description</Text>
                <Text style={styles.ledgerHeaderText}>Debit</Text>
                <Text style={styles.ledgerHeaderText}>Credit</Text>
                <Text style={styles.ledgerHeaderText}>Balance</Text>
            </View>

            {ledgerEntries.map((entry, idx) => (
                <View key={idx} style={styles.ledgerRow}>
                    <Text style={styles.ledgerDate}>{formatDateIST(entry.date)}</Text>
                    <Text style={styles.ledgerDesc}>{entry.description}</Text>
                    <Text style={[styles.ledgerDebit, { color: entry.debit > 0 ? '#EF4444' : '#94A3B8' }]}>
                        {entry.debit > 0 ? formatPaise(entry.debit) : '-'}
                    </Text>
                    <Text style={[styles.ledgerCredit, { color: entry.credit > 0 ? '#16A34A' : '#94A3B8' }]}>
                        {entry.credit > 0 ? formatPaise(entry.credit) : '-'}
                    </Text>
                    <Text style={[
                        styles.ledgerBalance,
                        { color: entry.balance < 0 ? '#EF4444' : entry.balance > 0 ? '#16A34A' : '#64748B' }
                    ]}>
                        {formatPaise(Math.abs(entry.balance))}
                        {entry.balance < 0 ? ' Dr' : entry.balance > 0 ? ' Cr' : ''}
                    </Text>
                </View>
            ))}

            {ledgerEntries.length === 0 && (
                <View style={styles.placeholderCard}>
                    <Text style={styles.emptyText}>No ledger entries found</Text>
                </View>
            )}

            {ledgerEntries.length > 0 && (
                <View style={[styles.summaryCard, { marginTop: 16 }]}>
                    <Text style={styles.summaryCardTitle}>Ledger Summary</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Final Balance:</Text>
                        <Text style={[
                            styles.summaryValue,
                            { color: runningBalance < 0 ? '#EF4444' : runningBalance > 0 ? '#16A34A' : '#64748B' }
                        ]}>
                            {formatPaise(Math.abs(runningBalance))}
                            {runningBalance < 0 ? ' (Owed)' : runningBalance > 0 ? ' (Credit)' : ''}
                        </Text>
                    </View>
                    <Text style={styles.ledgerNote}>
                        {runningBalance < 0 && 'Negative balance indicates customer owes money.'}
                        {runningBalance > 0 && 'Positive balance indicates customer has credit.'}
                        {runningBalance === 0 && 'All payments settled.'}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: '#F8FAFC',
    },
    emptyTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 18,
        color: '#0B1C30',
        marginBottom: 8,
    },
    emptyText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
    },
    groupSelector: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    groupSelectorContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    groupChip: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        minWidth: 160,
    },
    groupChipActive: {
        backgroundColor: '#0EA5E9',
        borderColor: '#0284C7',
    },
    groupChipName: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: '#0B1C30',
        marginBottom: 4,
    },
    groupChipNameActive: {
        color: '#FFFFFF',
    },
    groupChipMeta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
    },
    groupChipMetaActive: {
        color: 'rgba(255,255,255,0.9)',
    },
    groupChipTicket: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: '#0EA5E9',
        marginBottom: 6,
    },
    groupChipTicketActive: {
        color: 'rgba(255,255,255,0.9)',
    },
    groupChipBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    groupChipBadgeText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 10,
    },
    innerTabsContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    innerTabs: {
        paddingHorizontal: 16,
        gap: 4,
    },
    innerTab: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    innerTabActive: {
        borderBottomColor: '#0EA5E9',
    },
    innerTabText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: '#64748B',
    },
    innerTabTextActive: {
        color: '#0EA5E9',
    },
    tabContent: {
        flex: 1,
    },
    tabContentInner: {
        padding: 16,
    },
    placeholderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    placeholderTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 8,
    },
    placeholderText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    // Summary Tab Styles
    foreclosedAlert: {
        flexDirection: 'row',
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
        gap: 12,
    },
    alertIcon: {
        fontSize: 24,
    },
    alertTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 15,
        color: '#B91C1C',
        marginBottom: 4,
    },
    alertText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        color: '#7F1D1D',
        lineHeight: 18,
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    summaryCardTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    summaryLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: '#64748B',
    },
    summaryValue: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: '#0B1C30',
    },
    // Payment History Tab Styles
    paymentRow: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    paymentRowOverdue: {
        borderColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
    },
    paymentRowWon: {
        borderColor: '#FDE047',
        backgroundColor: '#FEFCE8',
    },
    paymentRowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 14,
    },
    paymentRowLeft: {
        flex: 1,
    },
    paymentMonth: {
        fontFamily: 'Inter_700Bold',
        fontSize: 15,
        color: '#0B1C30',
        marginBottom: 4,
    },
    wonBadge: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: '#92400E',
        marginBottom: 4,
    },
    postWinBadge: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: '#7C3AED',
        marginBottom: 4,
    },
    paymentDueDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
    },
    paymentRowRight: {
        alignItems: 'flex-end',
    },
    paymentAmount: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 4,
    },
    paymentStatus: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
    },
    paymentRowExpanded: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    paymentDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    paymentDetailLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: '#64748B',
    },
    paymentDetailValue: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: '#0B1C30',
    },
    lateIndicator: {
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        padding: 10,
        marginTop: 10,
    },
    lateText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: '#92400E',
    },
    txSection: {
        marginTop: 12,
    },
    txSectionTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 12,
        color: '#0B1C30',
        marginBottom: 6,
    },
    txRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        paddingLeft: 8,
    },
    txRowFailed: {
        opacity: 0.6,
    },
    txDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
    },
    txDateFailed: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#EF4444',
        textDecorationLine: 'line-through',
    },
    txAmount: {
        fontFamily: 'SpaceGrotesk_500Medium',
        fontSize: 12,
        color: '#16A34A',
    },
    txAmountFailed: {
        fontFamily: 'SpaceGrotesk_500Medium',
        fontSize: 12,
        color: '#EF4444',
        textDecorationLine: 'line-through',
    },
    // Auction History Tab Styles
    auctionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    auctionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    auctionCycle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 15,
        color: '#0B1C30',
        marginBottom: 2,
    },
    auctionDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
    },
    auctionBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    auctionBadgeText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
        letterSpacing: 0.5,
    },
    auctionDetails: {
        gap: 6,
    },
    auctionDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    auctionDetailLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: '#64748B',
    },
    auctionDetailValue: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 13,
        color: '#0B1C30',
    },
    auctionPending: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#94A3B8',
        fontStyle: 'italic',
    },
    // Ledger Tab Styles
    ledgerHeader: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    ledgerHeaderText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
        color: '#475569',
        flex: 1,
        textAlign: 'center',
    },
    ledgerRow: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 12,
        marginBottom: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    ledgerDate: {
        fontFamily: 'Inter_500Medium',
        fontSize: 11,
        color: '#64748B',
        flex: 1,
    },
    ledgerDesc: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        color: '#0B1C30',
        flex: 2,
    },
    ledgerDebit: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 11,
        flex: 1,
        textAlign: 'right',
    },
    ledgerCredit: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 11,
        flex: 1,
        textAlign: 'right',
    },
    ledgerBalance: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 11,
        flex: 1,
        textAlign: 'right',
    },
    ledgerNote: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        marginTop: 8,
        fontStyle: 'italic',
    },
    // Cash Collection Styles
    cashButtonContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
    },
    recordCashBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#01789E',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        shadowColor: '#01789E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    recordCashBtnText: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 15,
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    cashSection: {
        backgroundColor: '#FFFBEB',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginTop: 12,
    },
    cashSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    editCashBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    deleteCashBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    cashDenominationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#FDE68A',
    },
    cashDenomText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: '#92400E',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    cashNotesBox: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#FDE68A',
    },
    cashNotesLabel: {
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
        color: '#92400E',
        marginBottom: 4,
    },
    cashNotesText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#78350F',
        fontStyle: 'italic',
    },
});
