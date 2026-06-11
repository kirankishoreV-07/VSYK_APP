import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ChitMember, InnerTab, PaymentSchedule, Transaction, Auction, AuctionParticipant, CashCollection, AuctionPrizeSettlement } from './types';
import {
    formatPaise,
    formatDateIST,
    dedupeAuctionCycles,
    getGroupChipLabel,
} from './utils';
import { supabase } from '../../../../lib/supabase';
import { RecordCashCollectionModal } from './RecordCashCollectionModal';
import { PaymentHistoryTab } from './PaymentHistoryTab';
import { AdminColors } from './adminStyles';
import {
    getMemberWonAuctions,
    isMemberAuctionWinner,
    WINNER_HIGHLIGHT,
} from '../../../../lib/auctionWinner';
import { getFullyCollectedMonths } from '../../../../lib/chitPayments';

interface GroupsTabProps {
    memberships: ChitMember[];
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    auctions: Auction[];
    participants: AuctionParticipant[];
    customerName?: string;
    prizeSettlements?: AuctionPrizeSettlement[];
}

const INNER_TABS: Array<{ key: InnerTab; label: string }> = [
    { key: 'summary', label: 'Summary' },
    { key: 'payment-history', label: 'Payment History' },
    { key: 'auction-history', label: 'Auction History' },
    { key: 'documents', label: 'Docs' },
    { key: 'ledger', label: 'Ledger' },
];

export function GroupsTab({
    memberships,
    schedules,
    transactions,
    auctions,
    participants,
    customerName = 'Customer',
    prizeSettlements = [],
}: GroupsTabProps) {
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
        memberships.length > 0 ? memberships[0].id : null
    );
    const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>('payment-history');
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

    const groupAuctions = useMemo(() => {
        const filtered = auctions.filter(a => a.chit_group_id === selectedMembership?.chit_group_id);
        return dedupeAuctionCycles(filtered) as Auction[];
    }, [auctions, selectedMembership]);

    const wonAuctions = useMemo(
        () => getMemberWonAuctions(groupAuctions, selectedGroupId),
        [groupAuctions, selectedGroupId],
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
    const fullyCollectedMonths = useMemo(() => {
        if (!selectedMembership) return [];
        return getFullyCollectedMonths(
            groupCashCollections,
            selectedMembership.chit_groups.monthly_installment,
            groupAuctions,
            editingCollection?.id,
        );
    }, [groupCashCollections, selectedMembership, groupAuctions, editingCollection?.id]);

    const allMonthsCovered =
        selectedMembership != null
        && fullyCollectedMonths.length >= selectedMembership.chit_groups.duration_months;

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

    const renderTabContent = () => {
        if (!selectedMembership) return null;

        switch (activeInnerTab) {
            case 'summary':
                return (
                    <SummaryInnerTab
                        membership={selectedMembership}
                        schedules={groupSchedules}
                        transactions={groupTransactions}
                        wonAuctions={wonAuctions}
                        cashCollections={groupCashCollections}
                    />
                );
            case 'payment-history':
                return (
                    <PaymentHistoryTab
                        membership={selectedMembership}
                        schedules={groupSchedules}
                        transactions={groupTransactions}
                        cashCollections={groupCashCollections}
                        groupAuctions={groupAuctions}
                        prizeSettlements={prizeSettlements}
                        customerName={customerName}
                        onEditCash={handleEditCashCollection}
                        onDeleteCash={handleDeleteCashCollection}
                    />
                );
            case 'auction-history':
                return (
                    <AuctionHistoryInnerTab
                        membership={selectedMembership}
                        auctions={groupAuctions}
                        participants={participants}
                    />
                );
            case 'documents':
                return (
                    <View style={styles.placeholderCard}>
                        <Text style={styles.placeholderTitle}>Documents Module Coming Soon</Text>
                        <Text style={styles.placeholderText}>
                            Will display KYC documents (Aadhaar, PAN), signed agreements, and nominee forms once the
                            customer_documents table is created.
                        </Text>
                    </View>
                );
            case 'ledger':
                return (
                    <LedgerInnerTab
                        membership={selectedMembership}
                        schedules={groupSchedules}
                        transactions={groupTransactions}
                        auctions={groupAuctions}
                        prizeSettlements={prizeSettlements}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Fixed header: group chips + tabs */}
            <View style={styles.headerSection}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.groupSelectorContent}
                >
                    {memberships.map((membership) => {
                        const isSelected = membership.id === selectedGroupId;
                        const chipLabel = getGroupChipLabel(
                            membership.chit_groups.name,
                            membership.ticket_number,
                            membership.chit_groups.value,
                        );
                        return (
                            <TouchableOpacity
                                key={membership.id}
                                style={[styles.groupChip, isSelected && styles.groupChipActive]}
                                onPress={() => setSelectedGroupId(membership.id)}
                                activeOpacity={0.85}
                            >
                                <View
                                    style={[
                                        styles.groupChipDot,
                                        isSelected ? styles.groupChipDotActive : styles.groupChipDotInactive,
                                    ]}
                                />
                                <Text
                                    style={[styles.groupChipName, isSelected && styles.groupChipNameActive]}
                                    numberOfLines={1}
                                >
                                    {chipLabel}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {selectedMembership && (
                    <>
                        {isUnaccountedGroup && !allMonthsCovered && (
                            <View style={styles.cashButtonContainer}>
                                <TouchableOpacity style={styles.recordCashBtn} onPress={handleRecordCash}>
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
                    </>
                )}
            </View>

            {/* Scrollable tab body — no nested flex collapse */}
            {selectedMembership && (
                <ScrollView
                    style={styles.tabContent}
                    contentContainerStyle={styles.tabContentInner}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                >
                    {renderTabContent()}
                </ScrollView>
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
                    auctions={groupAuctions}
                    cashCollections={groupCashCollections}
                    coveredMonths={fullyCollectedMonths}
                    onSuccess={() => {
                        setCashModalVisible(false);
                        setEditingCollection(null);
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
    wonAuctions: Auction[];
    cashCollections: CashCollection[];
}

function SummaryInnerTab({ membership, schedules, transactions, wonAuctions, cashCollections }: SummaryInnerTabProps) {
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

            {wonAuctions.length > 0 && (
                <View style={[styles.summaryCard, styles.wonAuctionSummaryCard]}>
                    <Text style={[styles.summaryCardTitle, { color: WINNER_HIGHLIGHT.text }]}>
                        Auction{wonAuctions.length > 1 ? 's' : ''} Won
                    </Text>
                    {wonAuctions
                        .sort((a, b) => (a.auction_number || 0) - (b.auction_number || 0))
                        .map((wonAuction, idx) => (
                            <View key={wonAuction.id} style={[styles.wonAuctionEntry, idx > 0 && styles.wonAuctionEntryDivider]}>
                                <View style={styles.wonAuctionEntryHeader}>
                                    <Text style={styles.summaryLabel}>Cycle {wonAuction.auction_number}</Text>
                                    <View style={styles.winnerPill}>
                                        <Text style={styles.winnerPillText}>WINNER</Text>
                                    </View>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Prize Amount:</Text>
                                    <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
                                        {formatPaise(wonAuction.winner_prize_amount || 0)}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Date Won:</Text>
                                    <Text style={styles.summaryValue}>
                                        {formatDateIST(wonAuction.ended_at || wonAuction.scheduled_at)}
                                    </Text>
                                </View>
                            </View>
                        ))}
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
            const won = isMemberAuctionWinner(auction, membership.id);

            return { auction, participated, won };
        });

    return (
        <View>
            {auctionRows.map(({ auction, participated, won }) => (
                <View key={auction.id} style={[styles.auctionCard, won && styles.auctionCardWinner]}>
                    <View style={styles.auctionHeader}>
                        <View>
                            <Text style={[styles.auctionCycle, won && { color: WINNER_HIGHLIGHT.text }]}>
                                Cycle {auction.auction_number}
                            </Text>
                            <Text style={styles.auctionDate}>{formatDateIST(auction.ended_at || auction.scheduled_at)}</Text>
                        </View>
                        <View style={[
                            styles.auctionBadge,
                            {
                                backgroundColor: won ? WINNER_HIGHLIGHT.badgeBg : participated ? '#CCFBF1' : '#F1F5F9',
                                borderWidth: won ? 1 : 0,
                                borderColor: won ? WINNER_HIGHLIGHT.border : 'transparent',
                            }
                        ]}>
                            <Text style={[
                                styles.auctionBadgeText,
                                {
                                    color: won ? WINNER_HIGHLIGHT.badgeText : participated ? '#0F766E' : '#64748B',
                                }
                            ]}>
                                {won ? 'WINNER' : participated ? 'BID' : 'NO BID'}
                            </Text>
                        </View>
                    </View>

                    {auction.status === 'completed' && won && (
                        <View style={styles.auctionDetails}>
                            <View style={styles.auctionDetailRow}>
                                <Text style={styles.auctionDetailLabel}>Prize Received:</Text>
                                <Text style={[styles.auctionDetailValue, { color: '#16A34A' }]}>
                                    {formatPaise(auction.winner_prize_amount || 0)}
                                </Text>
                            </View>
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
    prizeSettlements?: AuctionPrizeSettlement[];
}

function LedgerInnerTab({ membership, schedules, transactions, auctions, prizeSettlements = [] }: LedgerInnerTabProps) {
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

    // Use actual disbursed prize payouts (from auction_prize_settlements) instead of the full entitled amount.
    // This ensures the ledger only shows credit for money the admin has actually paid out (partials supported).
    (prizeSettlements || [])
        .filter((ps: AuctionPrizeSettlement) => ps.chit_member_id === membership.id)
        .forEach((ps: AuctionPrizeSettlement) => {
            const relatedAuction = auctions.find((a: any) => a.id === ps.auction_id);
            const cycle = relatedAuction?.auction_number ?? '?';
            movements.push({
                date: ps.recorded_at,
                desc: `Auction Prize Payout (Cycle ${cycle})`,
                debit: 0,
                credit: ps.amount,
                type: 'prize',
            });
        });

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
        backgroundColor: AdminColors.bgTertiary,
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
    headerSection: {
        backgroundColor: AdminColors.bgTertiary,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(190,200,206,0.5)',
    },
    groupSelectorContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 10,
        alignItems: 'center',
    },
    groupChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#BEC8CE',
        maxWidth: 200,
        flexShrink: 0,
    },
    groupChipActive: {
        backgroundColor: AdminColors.primaryContainer,
        borderColor: AdminColors.primaryContainer,
        shadowColor: '#01789E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    groupChipDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    groupChipDotActive: {
        backgroundColor: '#54FAEF',
    },
    groupChipDotInactive: {
        backgroundColor: AdminColors.secondary,
    },
    groupChipName: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 13,
        color: '#3F484E',
        flexShrink: 1,
    },
    groupChipNameActive: {
        color: '#FFFFFF',
    },
    innerTabs: {
        paddingHorizontal: 20,
        gap: 20,
        paddingBottom: 0,
    },
    innerTab: {
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    innerTabActive: {
        borderBottomColor: AdminColors.primary,
    },
    innerTabText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: '#3F484E',
        letterSpacing: 0.5,
    },
    innerTabTextActive: {
        color: AdminColors.primary,
        fontFamily: 'Inter_700Bold',
    },
    tabContent: {
        flex: 1,
    },
    tabContentInner: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 120,
        flexGrow: 0,
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
        borderColor: WINNER_HIGHLIGHT.borderStrong,
        borderWidth: 2,
        backgroundColor: WINNER_HIGHLIGHT.bg,
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
    winnerPill: {
        alignSelf: 'flex-start',
        backgroundColor: WINNER_HIGHLIGHT.badgeBg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: WINNER_HIGHLIGHT.border,
        marginBottom: 4,
    },
    winnerPillText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 9,
        color: WINNER_HIGHLIGHT.badgeText,
        letterSpacing: 0.6,
    },
    wonAuctionSummaryCard: {
        backgroundColor: WINNER_HIGHLIGHT.bg,
        borderColor: WINNER_HIGHLIGHT.borderStrong,
        borderWidth: 2,
    },
    wonAuctionEntry: {
        paddingTop: 4,
    },
    wonAuctionEntryDivider: {
        paddingTop: 10,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: WINNER_HIGHLIGHT.border,
    },
    wonAuctionEntryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
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
    auctionCardWinner: {
        backgroundColor: WINNER_HIGHLIGHT.bg,
        borderColor: WINNER_HIGHLIGHT.borderStrong,
        borderWidth: 2,
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
