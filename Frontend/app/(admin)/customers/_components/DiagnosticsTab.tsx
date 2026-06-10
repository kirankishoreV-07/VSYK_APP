import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Transaction, PaymentSchedule, ChitMember } from './types';
import { formatPaise, formatDateTimeIST } from './utils';

interface DiagnosticsTabProps {
    transactions: Transaction[];
    schedules: PaymentSchedule[];
    memberships: ChitMember[];
}

export function DiagnosticsTab({ transactions, schedules, memberships }: DiagnosticsTabProps) {
    // Parse Razorpay orders from transaction notes
    const razorpayOrders = useMemo(() => {
        return transactions
            .filter(t => t.notes && t.notes.includes('order_'))
            .map(t => {
                let orderId = 'N/A';
                let paymentId = 'N/A';

                try {
                    const orderMatch = t.notes?.match(/order_[A-Za-z0-9]+/);
                    if (orderMatch) orderId = orderMatch[0];

                    const paymentMatch = t.notes?.match(/pay_[A-Za-z0-9]+/);
                    if (paymentMatch) paymentId = paymentMatch[0];
                } catch (e) {
                    // Ignore parsing errors
                }

                return {
                    transactionId: t.id,
                    orderId,
                    paymentId,
                    amount: t.amount,
                    status: t.status,
                    date: t.transaction_date,
                };
            })
            .slice(0, 20); // Last 20
    }, [transactions]);

    // Failed payments
    const failedPayments = useMemo(() => {
        return transactions
            .filter(t => t.status === 'failed')
            .map(t => {
                let errorCode = 'Unknown';
                let errorMessage = 'Payment failed';

                try {
                    if (t.notes) {
                        const codeMatch = t.notes.match(/error[_:]?\s*([A-Z_]+)/i);
                        if (codeMatch) errorCode = codeMatch[1];

                        const msgMatch = t.notes.match(/message[_:]?\s*(.+?)(\n|$)/i);
                        if (msgMatch) errorMessage = msgMatch[1].trim();
                    }
                } catch (e) {
                    // Ignore parsing errors
                }

                const membership = memberships.find(m => m.id === t.chit_member_id);

                return {
                    transactionId: t.id,
                    groupName: membership?.chit_groups?.name || 'Unknown',
                    amount: t.amount,
                    date: t.transaction_date,
                    errorCode,
                    errorMessage,
                };
            });
    }, [transactions, memberships]);

    // Data quality issues
    const dataIssues = useMemo(() => {
        const issues: Array<{ severity: 'error' | 'warning'; message: string }> = [];

        // Check for unlinked transactions
        const txWithoutSchedule = transactions.filter(t => {
            if (t.payment_type !== 'installment') return false;
            // Simplified check - in real app would match by month
            return !schedules.some(s => s.chit_member_id === t.chit_member_id);
        });
        if (txWithoutSchedule.length > 0) {
            issues.push({
                severity: 'warning',
                message: `${txWithoutSchedule.length} transaction(s) without matching schedule`,
            });
        }

        // Check for schedules with negative amounts
        const negativeSchedules = schedules.filter(s => s.amount < 0);
        if (negativeSchedules.length > 0) {
            issues.push({
                severity: 'error',
                message: `${negativeSchedules.length} schedule(s) with negative amounts`,
            });
        }

        // Check for old partial payments
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const oldPartials = schedules.filter(s => {
            if (s.paid) return false;
            const dueDate = new Date(s.due_date);
            if (dueDate > sixtyDaysAgo) return false;

            // Check if there are some payments
            const paid = transactions
                .filter(tx => tx.chit_member_id === s.chit_member_id && tx.status === 'completed')
                .reduce((sum, tx) => sum + tx.amount, 0);

            return paid > 0 && paid < s.amount;
        });
        if (oldPartials.length > 0) {
            issues.push({
                severity: 'warning',
                message: `${oldPartials.length} partial payment(s) older than 60 days`,
            });
        }

        return issues;
    }, [transactions, schedules]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Razorpay Orders */}
            <Text style={styles.sectionTitle}>Razorpay Orders (Last 20)</Text>
            {razorpayOrders.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No Razorpay order data found in transaction notes</Text>
                </View>
            ) : (
                razorpayOrders.map(order => (
                    <View key={order.transactionId} style={styles.card}>
                        <View style={styles.cardRow}>
                            <Text style={styles.label}>Order ID:</Text>
                            <Text style={styles.value}>{order.orderId}</Text>
                        </View>
                        <View style={styles.cardRow}>
                            <Text style={styles.label}>Payment ID:</Text>
                            <Text style={styles.value}>{order.paymentId}</Text>
                        </View>
                        <View style={styles.cardRow}>
                            <Text style={styles.label}>Amount:</Text>
                            <Text style={styles.value}>{formatPaise(order.amount)}</Text>
                        </View>
                        <View style={styles.cardRow}>
                            <Text style={styles.label}>Status:</Text>
                            <Text style={[
                                styles.value,
                                { color: order.status === 'completed' ? '#10B981' : '#EF4444' }
                            ]}>
                                {order.status.toUpperCase()}
                            </Text>
                        </View>
                        <Text style={styles.dateText}>{formatDateTimeIST(order.date)}</Text>
                    </View>
                ))
            )}

            {/* Failed Payments */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Failed Payments</Text>
            {failedPayments.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No failed payments found</Text>
                </View>
            ) : (
                failedPayments.map(fail => (
                    <View key={fail.transactionId} style={[styles.card, styles.cardError]}>
                        <View style={styles.cardRow}>
                            <Text style={styles.label}>Group:</Text>
                            <Text style={styles.value}>{fail.groupName}</Text>
                        </View>
                        <View style={styles.cardRow}>
                            <Text style={styles.label}>Amount:</Text>
                            <Text style={styles.value}>{formatPaise(fail.amount)}</Text>
                        </View>
                        <View style={styles.cardRow}>
                            <Text style={styles.label}>Error Code:</Text>
                            <Text style={[styles.value, { color: '#EF4444' }]}>{fail.errorCode}</Text>
                        </View>
                        <Text style={styles.errorMessage}>{fail.errorMessage}</Text>
                        <Text style={styles.dateText}>{formatDateTimeIST(fail.date)}</Text>
                    </View>
                ))
            )}

            {/* Data Quality Issues */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Data Quality</Text>
            {dataIssues.length === 0 ? (
                <View style={styles.successCard}>
                    <Text style={styles.successText}>✓ No data quality issues detected</Text>
                </View>
            ) : (
                dataIssues.map((issue, idx) => (
                    <View
                        key={idx}
                        style={[
                            styles.card,
                            issue.severity === 'error' ? styles.cardError : styles.cardWarning
                        ]}
                    >
                        <Text style={styles.issueLabel}>
                            {issue.severity === 'error' ? '⚠️ ERROR' : '⚡ WARNING'}
                        </Text>
                        <Text style={styles.issueMessage}>{issue.message}</Text>
                    </View>
                ))
            )}

            {/* Placeholder sections */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Webhook Events</Text>
            <View style={styles.todoCard}>
                <Text style={styles.todoTitle}>Feature Not Available</Text>
                <Text style={styles.todoText}>
                    Requires webhook persistence table — TODO. Webhook events are not currently stored in the
                    database.
                </Text>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Refund History</Text>
            <View style={styles.todoCard}>
                <Text style={styles.todoTitle}>Feature Not Available</Text>
                <Text style={styles.todoText}>
                    Requires refunds table or Razorpay API proxy — TODO. Direct Razorpay API calls from
                    client are not recommended.
                </Text>
            </View>
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
    sectionTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 12,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardError: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    cardWarning: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FEF3C7',
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    label: {
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        color: '#64748B',
    },
    value: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: '#0B1C30',
        flex: 1,
        textAlign: 'right',
    },
    dateText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
    },
    errorMessage: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
        fontStyle: 'italic',
    },
    issueLabel: {
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
        color: '#EF4444',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    issueMessage: {
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: '#0B1C30',
    },
    emptyCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    emptyText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
    },
    successCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    successText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: '#16A34A',
    },
    todoCard: {
        backgroundColor: '#FFFBEB',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    todoTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 13,
        color: '#D97706',
        marginBottom: 6,
    },
    todoText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#92400E',
        lineHeight: 18,
    },
});
