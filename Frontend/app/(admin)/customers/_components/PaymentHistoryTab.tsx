import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ChitMember, PaymentSchedule, Transaction, Auction, CashCollection, AuctionPrizeSettlement } from './types';
import {
    formatPaise,
    formatDateIST,
    formatDateTimeIST,
    exportToCSV,
    generateCSVFilename,
    getCycleDueAmount,
} from './utils';
import { getMemberWonAuctionNumbers, WINNER_HIGHLIGHT } from '../../../../lib/auctionWinner';
import { shareCsvFile } from '../../../../lib/csvExport';
import { AdminColors, softElevation } from './adminStyles';

type StatusFilter = 'All' | 'Paid' | 'Pending' | 'Overdue' | 'Partial';
type MethodFilter = 'All' | 'UPI' | 'Bank Transfer' | 'Cash' | 'Online';

interface PaymentRowData {
    schedule: PaymentSchedule;
    cycleDue: number | null;
    dueKnown: boolean;
    cashCollection?: CashCollection;
    completedTxs: Transaction[];
    failedTxs: Transaction[];
    refundedTxs: Transaction[];
    netPaid: number;
    remaining: number;
    status: string;
    isOverdue: boolean;
    isLate: boolean;
    daysLate: number;
    isWonMonth: boolean;
    paidOn: string | null;
    method: string;
}

interface PaymentHistoryTabProps {
    membership: ChitMember;
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    cashCollections: CashCollection[];
    groupAuctions: Auction[];
    prizeSettlements?: AuctionPrizeSettlement[];
    customerName: string;
    onEditCash: (collection: CashCollection) => void;
    onDeleteCash: (collection: CashCollection) => void;
}

const PAGE_SIZE = 5;
const ROADMAP_COLS = 6;
const H_PAD = 40;
const GRID_GAP = 8;

function getMethodFromTxs(txs: Transaction[]): string {
    if (txs.length === 0) return '—';
    const notes = (txs[0].notes || '').toLowerCase();
    if (notes.includes('upi')) return 'UPI';
    if (notes.includes('cash')) return 'Cash';
    if (notes.includes('bank')) return 'Bank Transfer';
    return 'Online';
}

function getRoadmapStatus(row: PaymentRowData): 'paid' | 'partial' | 'overdue' | 'future' {
    if (!row.dueKnown || row.status === 'Pending') return 'future';
    if (row.status === 'Full') return 'paid';
    if (row.status === 'Partial') return 'partial';
    if (row.isOverdue) return 'overdue';
    return 'future';
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const display = value === 'All' ? `${label}: All` : value;

    return (
        <View style={styles.filterSelectWrap}>
            <TouchableOpacity style={styles.filterSelect} onPress={() => setOpen(!open)} activeOpacity={0.85}>
                <Text style={styles.filterSelectText} numberOfLines={1}>
                    {display}
                </Text>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill={AdminColors.slate400}>
                    <Path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </Svg>
            </TouchableOpacity>
            {open && (
                <View style={styles.filterDropdown}>
                    {options.map((opt) => (
                        <TouchableOpacity
                            key={opt}
                            style={[styles.filterOption, value === opt && styles.filterOptionActive]}
                            onPress={() => {
                                onChange(opt);
                                setOpen(false);
                            }}
                        >
                            <Text
                                style={[
                                    styles.filterOptionText,
                                    value === opt && styles.filterOptionTextActive,
                                ]}
                            >
                                {opt === 'All' ? `${label}: All` : opt}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

export function PaymentHistoryTab({
    membership,
    schedules,
    transactions,
    cashCollections,
    groupAuctions,
    prizeSettlements = [],
    customerName,
    onEditCash,
    onDeleteCash,
}: PaymentHistoryTabProps) {
    const { width: screenWidth } = useWindowDimensions();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [yearFilter, setYearFilter] = useState<string>('All');
    const [methodFilter, setMethodFilter] = useState<MethodFilter>('All');
    const [page, setPage] = useState(0);
    const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

    const cellSize = Math.floor(
        (screenWidth - H_PAD - GRID_GAP * (ROADMAP_COLS - 1)) / ROADMAP_COLS,
    );

    const isUnaccounted = membership.chit_groups.accounting_type === 'unaccounted';
    const wonMonths = useMemo(
        () => getMemberWonAuctionNumbers(groupAuctions, membership.id),
        [groupAuctions, membership.id],
    );

    const paymentRows: PaymentRowData[] = useMemo(() => {
        return schedules
            .sort((a, b) => a.month_number - b.month_number)
            .map((schedule) => {
                if (isUnaccounted) {
                    const cashCollection = cashCollections.find((c) => c.month_number === schedule.month_number);
                    const netPaid = cashCollection?.amount || 0;
                    const cycleDue = getCycleDueAmount(
                        schedule.month_number,
                        membership.chit_groups.monthly_installment,
                        groupAuctions,
                    );
                    const dueKnown = cycleDue != null;
                    const remaining = dueKnown ? Math.max(0, cycleDue - netPaid) : 0;
                    const status = !dueKnown
                        ? 'Pending'
                        : netPaid >= cycleDue
                          ? 'Full'
                          : netPaid > 0
                            ? 'Partial'
                            : 'Unpaid';
                    const isOverdue = dueKnown && !cashCollection && new Date(schedule.due_date) < new Date();

                    return {
                        schedule: { ...schedule, amount: cycleDue ?? 0 },
                        cycleDue,
                        dueKnown,
                        cashCollection,
                        completedTxs: [],
                        failedTxs: [],
                        refundedTxs: [],
                        netPaid,
                        remaining,
                        status,
                        isOverdue,
                        isLate: false,
                        daysLate: 0,
                        isWonMonth: wonMonths.has(schedule.month_number),
                        paidOn: cashCollection?.recorded_at || null,
                        method: 'Cash',
                    };
                }

                const cycleDue = getCycleDueAmount(
                    schedule.month_number,
                    membership.chit_groups.monthly_installment,
                    groupAuctions,
                );
                const dueKnown = cycleDue != null;
                const monthTxs = transactions.filter(
                    (t) => {
                        if (t.payment_type !== 'installment') return false;
                        if (t.payment_schedule_id) return t.payment_schedule_id === schedule.id;
                        if (t.auction_id) {
                            return groupAuctions.some(
                                (a) => a.id === t.auction_id && a.auction_number === schedule.month_number,
                            );
                        }
                        const notedMonth = t.notes?.match(/Month\s+(\d+)/i)?.[1];
                        return notedMonth ? Number(notedMonth) === schedule.month_number : false;
                    },
                );
                const completedTxs = monthTxs.filter((t) => t.status === 'completed' || t.status === 'success');
                const failedTxs = monthTxs.filter((t) => t.status === 'failed');
                const refundedTxs = monthTxs.filter((t) => t.status === 'refunded');
                const totalPaid = completedTxs.reduce((sum, t) => sum + t.amount, 0);
                const refunded = refundedTxs.reduce((sum, t) => sum + t.amount, 0);
                const netPaid = totalPaid - refunded;
                const remaining = dueKnown ? Math.max(0, cycleDue - netPaid) : 0;
                const status = !dueKnown
                    ? 'Pending'
                    : netPaid >= cycleDue
                      ? 'Full'
                      : netPaid > 0
                        ? 'Partial'
                        : 'Unpaid';
                const isOverdue = dueKnown && !schedule.paid && new Date(schedule.due_date) < new Date();
                const latestCompletedTx = completedTxs.sort(
                    (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
                )[0];
                const isLate =
                    !!latestCompletedTx && new Date(latestCompletedTx.transaction_date) > new Date(schedule.due_date);
                const daysLate = isLate
                    ? Math.floor(
                          (new Date(latestCompletedTx!.transaction_date).getTime() -
                              new Date(schedule.due_date).getTime()) /
                              (24 * 60 * 60 * 1000),
                      )
                    : 0;

                return {
                    schedule: { ...schedule, amount: cycleDue ?? 0 },
                    cycleDue,
                    dueKnown,
                    completedTxs,
                    failedTxs,
                    refundedTxs,
                    netPaid,
                    remaining,
                    status,
                    isOverdue,
                    isLate,
                    daysLate,
                    isWonMonth: wonMonths.has(schedule.month_number),
                    paidOn: latestCompletedTx?.transaction_date || schedule.paid_at,
                    method: getMethodFromTxs(completedTxs),
                };
            });
    }, [schedules, transactions, cashCollections, groupAuctions, membership, isUnaccounted, wonMonths]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        paymentRows.forEach((r) => {
            if (r.schedule.due_date) {
                years.add(new Date(r.schedule.due_date).getFullYear().toString());
            }
        });
        return Array.from(years).sort((a, b) => Number(b) - Number(a));
    }, [paymentRows]);

    const filteredRows = useMemo(() => {
        return paymentRows.filter((row) => {
            if (statusFilter === 'Paid' && row.status !== 'Full') return false;
            if (statusFilter === 'Partial' && row.status !== 'Partial') return false;
            if (statusFilter === 'Pending' && row.status !== 'Pending' && row.status !== 'Unpaid') return false;
            if (statusFilter === 'Overdue' && !row.isOverdue) return false;

            if (yearFilter !== 'All' && row.schedule.due_date) {
                const year = new Date(row.schedule.due_date).getFullYear().toString();
                if (year !== yearFilter) return false;
            }

            if (methodFilter !== 'All') {
                const m = row.method.toLowerCase();
                if (methodFilter === 'UPI' && !m.includes('upi')) return false;
                if (methodFilter === 'Cash' && !m.includes('cash')) return false;
                if (methodFilter === 'Bank Transfer' && !m.includes('bank')) return false;
                if (methodFilter === 'Online' && (m.includes('cash') || m.includes('upi') || m.includes('bank')))
                    return false;
            }

            return true;
        });
    }, [paymentRows, statusFilter, yearFilter, methodFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages - 1);
    const pageRows = filteredRows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
    const paidCount = paymentRows.filter((r) => r.status === 'Full').length;

    const handleExport = async () => {
        const csv = exportToCSV(
            paymentRows.map((r) => ({
                cycle: r.schedule.month_number,
                dueDate: r.schedule.due_date,
                originalAmount: r.cycleDue ?? r.schedule.amount,
                dividendApplied: r.schedule.dividend_amount,
                netDue: r.cycleDue ?? r.schedule.amount,
                paidOn: r.paidOn,
                paidAmount: r.netPaid,
                remaining: r.remaining,
                method: r.method,
                status: r.isWonMonth ? 'Won Cycle' : r.status,
                refId: r.cashCollection?.id || r.completedTxs[0]?.id || null,
                winner: r.isWonMonth,
            })),
            customerName,
            membership.chit_groups.name,
            {
                ticketNumber: membership.ticket_number,
                accountingType: membership.chit_groups.accounting_type,
            },
        );
        try {
            await shareCsvFile({
                filename: generateCSVFilename(membership.customer_id, membership.chit_groups.name),
                content: csv,
                dialogTitle: `${customerName} — ${membership.chit_groups.name} payment history`,
            });
        } catch {
            Alert.alert('Export failed', 'Could not export payment history file.');
        }
    };

    const groupCode =
        membership.chit_groups.name.match(/[A-Z]\d+/)?.[0] ||
        membership.ticket_number ||
        formatPaise(membership.chit_groups.value).replace('₹', '');

    if (schedules.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Payment Schedules</Text>
                <Text style={styles.emptyText}>
                    Payment schedules for this group have not been generated yet.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            {/* Payment Roadmap */}
            <View style={styles.roadmapCard}>
                <View style={styles.roadmapHeaderRow}>
                    <Text style={styles.roadmapTitle}>Payment Roadmap</Text>
                    <Text style={styles.roadmapSubtitle}>
                        {groupCode} ({membership.chit_groups.duration_months} Months)
                    </Text>
                </View>

                <View style={styles.legendRow}>
                    {[
                        { color: AdminColors.secondary, label: 'Paid' },
                        { color: '#FACC15', label: 'Partial' },
                        { color: '#BA1A1A', label: 'Overdue' },
                        { color: AdminColors.slate200, label: 'Future' },
                    ].map((item) => (
                        <View key={item.label} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                            <Text style={styles.legendText}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.roadmapGrid}>
                    {paymentRows.map((row) => {
                        const roadmapStatus = getRoadmapStatus(row);
                        const isWinner = row.isWonMonth && row.status === 'Full';

                        return (
                            <View
                                key={row.schedule.id}
                                style={[
                                    styles.roadmapCell,
                                    { width: cellSize, height: cellSize },
                                    roadmapStatus === 'paid' && styles.roadmapPaid,
                                    roadmapStatus === 'partial' && styles.roadmapPartial,
                                    roadmapStatus === 'overdue' && styles.roadmapOverdue,
                                    roadmapStatus === 'future' && styles.roadmapFuture,
                                    isWinner && styles.roadmapWinner,
                                ]}
                            >
                                {roadmapStatus === 'paid' ? (
                                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="#FFFFFF">
                                        <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                    </Svg>
                                ) : (
                                    <Text
                                        style={[
                                            styles.roadmapCellText,
                                            roadmapStatus === 'partial' && { color: '#A16207' },
                                            roadmapStatus === 'overdue' && { color: '#BA1A1A' },
                                            roadmapStatus === 'future' && { color: AdminColors.slate400 },
                                        ]}
                                    >
                                        {row.schedule.month_number}
                                    </Text>
                                )}
                                {isWinner && (
                                    <View style={styles.roadmapWinnerBadge}>
                                        <Text style={styles.roadmapWinnerText}>W</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Filters — Stitch dropdown row */}
            <View style={styles.filtersCard}>
                <View style={styles.filtersRow}>
                    <FilterSelect
                        label="Status"
                        value={statusFilter}
                        options={['All', 'Paid', 'Partial', 'Pending', 'Overdue']}
                        onChange={(v) => {
                            setStatusFilter(v as StatusFilter);
                            setPage(0);
                        }}
                    />
                    <FilterSelect
                        label="Year"
                        value={yearFilter}
                        options={['All', ...availableYears]}
                        onChange={(v) => {
                            setYearFilter(v);
                            setPage(0);
                        }}
                    />
                </View>
                <View style={styles.filtersRow}>
                    <FilterSelect
                        label="Method"
                        value={methodFilter}
                        options={['All', 'UPI', 'Bank Transfer', 'Cash', 'Online']}
                        onChange={(v) => {
                            setMethodFilter(v as MethodFilter);
                            setPage(0);
                        }}
                    />
                    <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill={AdminColors.primaryContainer}>
                            <Path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                        </Svg>
                        <Text style={styles.exportBtnText}>Export to CSV</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Payment cycles — mobile-friendly cards */}
            <View style={styles.tableCard}>
                <View style={styles.tableHeadRow}>
                    <Text style={styles.tableHeadText}>Cycle</Text>
                    <Text style={styles.tableHeadText}>Due Date</Text>
                    <Text style={[styles.tableHeadText, styles.tableHeadRight]}>Net Due</Text>
                </View>

                {pageRows.length === 0 ? (
                    <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>No payments match the selected filters</Text>
                    </View>
                ) : (
                    pageRows.map((row) => {
                        const isExpanded = expandedMonth === row.schedule.month_number;
                        const displayStatus =
                            row.isWonMonth && row.status === 'Full'
                                ? 'Won Cycle'
                                : row.status === 'Full'
                                  ? 'Paid'
                                  : row.status === 'Pending'
                                    ? 'Pending'
                                    : row.isOverdue
                                      ? 'Overdue'
                                      : row.status;

                        return (
                            <View key={row.schedule.id}>
                                <TouchableOpacity
                                    style={[
                                        styles.cycleCard,
                                        row.isWonMonth && row.status === 'Full' && styles.cycleCardWinner,
                                    ]}
                                    onPress={() =>
                                        setExpandedMonth(isExpanded ? null : row.schedule.month_number)
                                    }
                                    activeOpacity={0.9}
                                >
                                    <View style={styles.cycleCardTop}>
                                        <View style={styles.cycleLeft}>
                                            <Text style={styles.cycleNumber}>
                                                #{String(row.schedule.month_number).padStart(2, '0')}
                                            </Text>
                                            {row.isWonMonth && (
                                                <View style={styles.winnerPill}>
                                                    <Text style={styles.winnerPillText}>WINNER</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                displayStatus === 'Paid' && styles.statusPaid,
                                                displayStatus === 'Won Cycle' && styles.statusWon,
                                                displayStatus === 'Overdue' && styles.statusOverdue,
                                                displayStatus === 'Partial' && styles.statusPartial,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusBadgeText,
                                                    displayStatus === 'Paid' && { color: AdminColors.secondary },
                                                    displayStatus === 'Won Cycle' && { color: '#A16207' },
                                                    displayStatus === 'Overdue' && { color: '#BA1A1A' },
                                                    displayStatus === 'Partial' && { color: '#A16207' },
                                                ]}
                                            >
                                                {displayStatus.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.cycleCardGrid}>
                                        <View style={styles.cycleField}>
                                            <Text style={styles.fieldLabel}>Due Date</Text>
                                            <Text style={styles.fieldValue}>
                                                {formatDateIST(row.schedule.due_date)}
                                            </Text>
                                        </View>
                                        <View style={styles.cycleField}>
                                            <Text style={styles.fieldLabel}>Net Due</Text>
                                            <Text style={[styles.fieldValue, styles.fieldValueBold]}>
                                                {row.dueKnown ? formatPaise(row.schedule.amount) : '—'}
                                            </Text>
                                            {row.isWonMonth && row.dueKnown && (
                                                <Text style={styles.prizeAdjusted}>Prize Adjusted</Text>
                                            )}
                                        </View>
                                        <View style={styles.cycleField}>
                                            <Text style={styles.fieldLabel}>Paid On</Text>
                                            <Text style={styles.fieldValue}>
                                                {row.paidOn ? formatDateIST(row.paidOn) : '—'}
                                            </Text>
                                        </View>
                                        <View style={styles.cycleField}>
                                            <Text style={styles.fieldLabel}>Method</Text>
                                            <Text style={styles.fieldValue}>{row.method}</Text>
                                        </View>
                                    </View>

                                    {row.isLate && (
                                        <Text style={styles.lateSubtext}>Late ({row.daysLate} days)</Text>
                                    )}
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.expandedPanel}>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Amount Paid</Text>
                                            <Text style={[styles.detailValue, { color: '#16A34A' }]}>
                                                {formatPaise(row.netPaid)}
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Remaining</Text>
                                            <Text
                                                style={[
                                                    styles.detailValue,
                                                    { color: row.remaining > 0 ? '#BA1A1A' : '#16A34A' },
                                                ]}
                                            >
                                                {formatPaise(row.remaining)}
                                            </Text>
                                        </View>
                                        {isUnaccounted && row.cashCollection && (
                                            <View style={styles.cashActions}>
                                                <TouchableOpacity
                                                    style={styles.cashActionBtn}
                                                    onPress={() => onEditCash(row.cashCollection!)}
                                                >
                                                    <Text style={styles.cashActionText}>Edit Cash</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.cashActionBtn, styles.cashDeleteBtn]}
                                                    onPress={() => onDeleteCash(row.cashCollection!)}
                                                >
                                                    <Text style={[styles.cashActionText, { color: '#BA1A1A' }]}>
                                                        Delete
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {!isUnaccounted &&
                                            row.completedTxs.map((tx) => (
                                                <View key={tx.id} style={styles.txMiniRow}>
                                                    <Text style={styles.txMiniDate}>
                                                        {formatDateTimeIST(tx.transaction_date)}
                                                    </Text>
                                                    <Text style={styles.txMiniAmount}>
                                                        {formatPaise(tx.amount)}
                                                    </Text>
                                                </View>
                                            ))}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}

                <View style={styles.pagination}>
                    <Text style={styles.paginationText}>
                        Showing {filteredRows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1} to{' '}
                        {Math.min((currentPage + 1) * PAGE_SIZE, filteredRows.length)} of {paidCount} paid
                        cycles
                    </Text>
                    <View style={styles.paginationBtns}>
                        <TouchableOpacity
                            style={[styles.pageBtn, currentPage === 0 && styles.pageBtnDisabled]}
                            onPress={() => setPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                        >
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill={AdminColors.slate400}>
                                <Path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                            </Svg>
                        </TouchableOpacity>
                        {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.pageBtn, currentPage === i && styles.pageBtnActive]}
                                onPress={() => setPage(i)}
                            >
                                <Text
                                    style={[
                                        styles.pageBtnText,
                                        currentPage === i && styles.pageBtnTextActive,
                                    ]}
                                >
                                    {i + 1}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.pageBtn, currentPage >= totalPages - 1 && styles.pageBtnDisabled]}
                            onPress={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage >= totalPages - 1}
                        >
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill={AdminColors.slate400}>
                                <Path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                            </Svg>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        gap: 16,
    },
    emptyState: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 28,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        alignItems: 'center',
        ...softElevation,
    },
    emptyTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 16,
        color: AdminColors.textPrimary,
        marginBottom: 8,
    },
    emptyText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: AdminColors.slate500,
        textAlign: 'center',
        lineHeight: 20,
    },
    roadmapCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        ...softElevation,
    },
    roadmapHeaderRow: {
        marginBottom: 12,
    },
    roadmapTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 18,
        color: AdminColors.primary,
    },
    roadmapSubtitle: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: AdminColors.slate400,
        marginTop: 2,
    },
    legendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 2,
    },
    legendText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 10,
        color: AdminColors.textPrimary,
    },
    roadmapGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GRID_GAP,
    },
    roadmapCell: {
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    roadmapPaid: {
        backgroundColor: AdminColors.secondary,
    },
    roadmapPartial: {
        backgroundColor: 'rgba(250,204,21,0.2)',
        borderWidth: 2,
        borderColor: '#FACC15',
    },
    roadmapOverdue: {
        backgroundColor: 'rgba(186,26,26,0.1)',
        borderWidth: 2,
        borderColor: '#BA1A1A',
    },
    roadmapFuture: {
        backgroundColor: AdminColors.slate100,
    },
    roadmapWinner: {
        borderWidth: 2,
        borderColor: WINNER_HIGHLIGHT.border,
    },
    roadmapCellText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
    },
    roadmapWinnerBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: WINNER_HIGHLIGHT.badgeBg,
        borderWidth: 1,
        borderColor: WINNER_HIGHLIGHT.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roadmapWinnerText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 7,
        color: WINNER_HIGHLIGHT.badgeText,
    },
    filtersCard: {
        gap: 10,
    },
    filtersRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },
    filterSelectWrap: {
        flex: 1,
        position: 'relative',
        zIndex: 10,
    },
    filterSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#BEC8CE',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        minHeight: 42,
    },
    filterSelectText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: AdminColors.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    filterDropdown: {
        position: 'absolute',
        top: 44,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BEC8CE',
        zIndex: 100,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
    },
    filterOption: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: AdminColors.slate100,
    },
    filterOptionActive: {
        backgroundColor: 'rgba(1,120,158,0.08)',
    },
    filterOptionText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: AdminColors.textPrimary,
    },
    filterOptionTextActive: {
        fontFamily: 'Inter_600SemiBold',
        color: AdminColors.primaryContainer,
    },
    exportBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: AdminColors.primaryContainer,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        minHeight: 42,
    },
    exportBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: AdminColors.primaryContainer,
        letterSpacing: 0.3,
    },
    tableCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        overflow: 'hidden',
        ...softElevation,
    },
    tableHeadRow: {
        flexDirection: 'row',
        backgroundColor: '#EFF4FF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#BEC8CE',
    },
    tableHeadText: {
        flex: 1,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: '#3F484E',
        letterSpacing: 0.5,
    },
    tableHeadRight: {
        textAlign: 'right',
    },
    noResults: {
        padding: 24,
        alignItems: 'center',
    },
    noResultsText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: AdminColors.slate500,
    },
    cycleCard: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: AdminColors.slate100,
    },
    cycleCardWinner: {
        backgroundColor: 'rgba(254,243,199,0.5)',
        borderLeftWidth: 4,
        borderLeftColor: '#FACC15',
    },
    cycleCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    cycleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cycleNumber: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        color: AdminColors.primary,
    },
    winnerPill: {
        backgroundColor: WINNER_HIGHLIGHT.badgeBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: WINNER_HIGHLIGHT.border,
    },
    winnerPillText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 8,
        color: WINNER_HIGHLIGHT.badgeText,
        letterSpacing: 0.5,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
        backgroundColor: AdminColors.slate100,
    },
    statusPaid: {
        backgroundColor: 'rgba(0,106,101,0.1)',
    },
    statusWon: {
        backgroundColor: 'rgba(250,204,21,0.2)',
    },
    statusOverdue: {
        backgroundColor: 'rgba(186,26,26,0.1)',
    },
    statusPartial: {
        backgroundColor: 'rgba(250,204,21,0.2)',
    },
    statusBadgeText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 9,
        letterSpacing: 0.5,
        color: AdminColors.slate500,
    },
    cycleCardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    cycleField: {
        width: '46%',
    },
    fieldLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 10,
        color: AdminColors.slate400,
        letterSpacing: 0.3,
        marginBottom: 2,
    },
    fieldValue: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        color: '#475569',
    },
    fieldValueBold: {
        fontFamily: 'Inter_600SemiBold',
        color: AdminColors.textPrimary,
    },
    prizeAdjusted: {
        fontFamily: 'Inter_400Regular',
        fontSize: 10,
        color: AdminColors.slate400,
        marginTop: 2,
    },
    lateSubtext: {
        fontFamily: 'Inter_500Medium',
        fontSize: 10,
        color: '#BA1A1A',
        marginTop: 8,
    },
    expandedPanel: {
        backgroundColor: '#F8F9FF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: AdminColors.slate100,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    detailLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: AdminColors.slate500,
    },
    detailValue: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: AdminColors.textPrimary,
    },
    cashActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    cashActionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: AdminColors.primaryContainer,
    },
    cashDeleteBtn: {
        borderColor: '#FECACA',
    },
    cashActionText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: AdminColors.primaryContainer,
    },
    txMiniRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        marginTop: 4,
    },
    txMiniDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: AdminColors.slate500,
    },
    txMiniAmount: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 12,
        color: '#16A34A',
    },
    pagination: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: AdminColors.slate100,
    },
    paginationText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: AdminColors.slate400,
        flexShrink: 1,
    },
    paginationBtns: {
        flexDirection: 'row',
        gap: 6,
    },
    pageBtn: {
        width: 32,
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#BEC8CE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pageBtnActive: {
        borderColor: AdminColors.primary,
        backgroundColor: 'rgba(0,94,125,0.05)',
    },
    pageBtnDisabled: {
        opacity: 0.4,
    },
    pageBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: '#475569',
    },
    pageBtnTextActive: {
        color: AdminColors.primary,
        fontFamily: 'Inter_700Bold',
    },
});
