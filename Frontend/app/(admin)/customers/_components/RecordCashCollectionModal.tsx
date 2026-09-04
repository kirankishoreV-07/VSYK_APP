import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
    TextInput, Alert, Platform, KeyboardAvoidingView, Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../../lib/supabase';
import { formatDateIST, formatPaise } from './utils';
import {
    dedupeAuctionCycles,
    getCycleDueAmount,
    getCyclePaymentStatus,
    getCycleRemainingDue,
    type AuctionCycleInfo,
} from '../../../../lib/chitPayments';
import { isAuctionScheduledDisplay } from '../../../../lib/auctionUtils';
import type { ChitMember, ChitGroup, CashCollection } from './types';

type AuctionOption = AuctionCycleInfo;

function getAuctionStatusLabel(auction: AuctionOption): { label: string; color: string; bg: string } {
    if (auction.status === 'live') return { label: 'AUCTION LIVE', color: '#16A34A', bg: '#DCFCE7' };
    if (auction.status === 'completed') return { label: 'AUCTION SETTLED', color: '#005E7D', bg: '#E0F2FE' };
    if (isAuctionScheduledDisplay(auction)) return { label: 'SCHEDULED', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'AWAITING', color: '#64748B', bg: '#F1F5F9' };
}

function getCollectionStatusLabel(
    paymentStatus: ReturnType<typeof getCyclePaymentStatus>,
    remaining: number | null,
): { label: string; color: string; bg: string } | null {
    if (paymentStatus === 'full') return { label: 'COLLECTED', color: '#16A34A', bg: '#DCFCE7' };
    if (paymentStatus === 'partial') {
        return {
            label: remaining != null ? `PARTIAL · ${formatPaise(remaining)} left` : 'PARTIAL',
            color: '#B45309',
            bg: '#FEF3C7',
        };
    }
    if (paymentStatus === 'unpaid') return { label: 'DUE', color: '#DC2626', bg: '#FEE2E2' };
    return null;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    membership: ChitMember;
    onSuccess: () => void;
    existingCollection?: CashCollection | null;
    /** Render inline (no nested Modal) — use inside another Modal/sheet */
    embedded?: boolean;
    onBack?: () => void;
    auctions?: AuctionOption[];
    cashCollections?: CashCollection[];
    coveredMonths?: number[];
    /** Open group settlement for a blocked auction cycle */
    onRequestSettlement?: (auctionNumber: number) => void;
}

const DENOMINATIONS = [
    { value: 500, label: '₹500' },
    { value: 200, label: '₹200' },
    { value: 100, label: '₹100' },
    { value: 50, label: '₹50' },
    { value: 20, label: '₹20' },
    { value: 10, label: '₹10' },
];

export function RecordCashCollectionModal({
    visible,
    onClose,
    membership,
    onSuccess,
    existingCollection,
    embedded = false,
    onBack,
    auctions = [],
    cashCollections = [],
    coveredMonths = [],
    onRequestSettlement,
}: Props) {
    const slideAnim = React.useRef(new Animated.Value(800)).current;
    const group: ChitGroup = membership.chit_groups;

    const [monthNumber, setMonthNumber] = useState('');
    const [inlineEditing, setInlineEditing] = useState<CashCollection | null>(null);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Denomination counts
    const [denom500, setDenom500] = useState('0');
    const [denom200, setDenom200] = useState('0');
    const [denom100, setDenom100] = useState('0');
    const [denom50, setDenom50] = useState('0');
    const [denom20, setDenom20] = useState('0');
    const [denom10, setDenom10] = useState('0');
    const lastAutoFilledMonth = React.useRef('');

    // Load existing collection data when editing, or reset when opening a new entry
    useEffect(() => {
        if (!visible) return;
        if (existingCollection) {
            setMonthNumber(String(existingCollection.month_number));
            setAmount(String(existingCollection.amount / 100));
            setNotes(existingCollection.notes || '');
            setDenom500(String(existingCollection.denomination_500));
            setDenom200(String(existingCollection.denomination_200));
            setDenom100(String(existingCollection.denomination_100));
            setDenom50(String(existingCollection.denomination_50));
            setDenom20(String(existingCollection.denomination_20));
            setDenom10(String(existingCollection.denomination_10));
        } else {
            setMonthNumber('');
            setAmount('');
            setNotes('');
            setDenom500('0');
            setDenom200('0');
            setDenom100('0');
            setDenom50('0');
            setDenom20('0');
            setDenom10('0');
        }
    }, [existingCollection, visible]);

    useEffect(() => {
        if (embedded) return;
        if (visible) {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 800,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, embedded]);

    const auctionCycles = useMemo(() => dedupeAuctionCycles(auctions), [auctions]);
    const effectiveExisting = existingCollection ?? inlineEditing;

    const collectionByMonth = useMemo(() => {
        const map = new Map<number, CashCollection>();
        cashCollections.forEach((c) => {
            if (effectiveExisting?.id && c.id === effectiveExisting.id) return;
            map.set(c.month_number, c);
        });
        return map;
    }, [cashCollections, effectiveExisting?.id]);

    const isMonthFullyCollected = (month: number) => coveredMonths.includes(month);

    // Pre-select next open auction cycle when opening a new collection
    useEffect(() => {
        if (!visible || effectiveExisting) return;
        const nextAuction = auctionCycles.find((a) => {
            if (a.auction_number == null || isMonthFullyCollected(a.auction_number)) return false;
            return getCycleDueAmount(a.auction_number, group.monthly_installment, auctionCycles) != null;
        });
        if (nextAuction?.auction_number != null) {
            setMonthNumber(String(nextAuction.auction_number));
        }
    }, [visible, effectiveExisting, auctionCycles, coveredMonths]);

    const selectedMonthNum = parseInt(monthNumber) || 0;
    const expectedDuePaise = useMemo(() => {
        if (!selectedMonthNum) return null;
        return getCycleDueAmount(selectedMonthNum, group.monthly_installment, auctionCycles);
    }, [selectedMonthNum, group.monthly_installment, auctionCycles]);

    // Default amount when month changes (new entries or partial top-up)
    useEffect(() => {
        if (!visible || !monthNumber) return;
        if (monthNumber === lastAutoFilledMonth.current) return;
        lastAutoFilledMonth.current = monthNumber;

        if (effectiveExisting) {
            setAmount(String(effectiveExisting.amount / 100));
            setNotes(effectiveExisting.notes || '');
            setDenom500(String(effectiveExisting.denomination_500));
            setDenom200(String(effectiveExisting.denomination_200));
            setDenom100(String(effectiveExisting.denomination_100));
            setDenom50(String(effectiveExisting.denomination_50));
            setDenom20(String(effectiveExisting.denomination_20));
            setDenom10(String(effectiveExisting.denomination_10));
            return;
        }

        const month = parseInt(monthNumber);
        const duePaise = getCycleDueAmount(month, group.monthly_installment, auctionCycles);
        if (duePaise == null) {
            setAmount('');
            return;
        }

        const partial = collectionByMonth.get(month);
        const targetPaise = partial ? duePaise : duePaise;
        setAmount(String(targetPaise / 100));
        setDenom500('0');
        setDenom200('0');
        setDenom100('0');
        setDenom50('0');
        setDenom20('0');
        setDenom10('0');
    }, [monthNumber, visible, effectiveExisting, group.monthly_installment, auctionCycles, collectionByMonth]);

    useEffect(() => {
        if (!visible) {
            lastAutoFilledMonth.current = '';
            setInlineEditing(null);
        }
    }, [visible]);

    const denominationTotal = useMemo(() => {
        const d500 = parseInt(denom500) || 0;
        const d200 = parseInt(denom200) || 0;
        const d100 = parseInt(denom100) || 0;
        const d50 = parseInt(denom50) || 0;
        const d20 = parseInt(denom20) || 0;
        const d10 = parseInt(denom10) || 0;

        return (d500 * 500) + (d200 * 200) + (d100 * 100) + (d50 * 50) + (d20 * 20) + (d10 * 10);
    }, [denom500, denom200, denom100, denom50, denom20, denom10]);

    const amountInRupees = parseFloat(amount) || 0;
    const amountInPaise = Math.round(amountInRupees * 100);
    const denominationMatches = denominationTotal === amountInRupees;
    const isValid = monthNumber && expectedDuePaise != null && amountInPaise > 0 && denominationMatches;

    const paymentStatus = useMemo(() => {
        if (expectedDuePaise == null) return 'Unpaid';
        if (amountInPaise >= expectedDuePaise) return 'Full';
        if (amountInPaise > 0) return 'Partial';
        return 'Unpaid';
    }, [amountInPaise, expectedDuePaise]);

    const handleSave = async () => {
        if (!isValid) {
            Alert.alert('Validation Error', 'Please fill all required fields and ensure denomination matches amount.');
            return;
        }

        const monthNum = parseInt(monthNumber);
        if (monthNum < 1 || monthNum > group.duration_months) {
            Alert.alert('Invalid Month', `Month must be between 1 and ${group.duration_months}.`);
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const collectionData = {
                chit_member_id: membership.id,
                month_number: monthNum,
                amount: amountInPaise,
                denomination_500: parseInt(denom500) || 0,
                denomination_200: parseInt(denom200) || 0,
                denomination_100: parseInt(denom100) || 0,
                denomination_50: parseInt(denom50) || 0,
                denomination_20: parseInt(denom20) || 0,
                denomination_10: parseInt(denom10) || 0,
                notes: notes.trim() || null,
                recorded_by: (await supabase.auth.getUser()).data.user?.id || null,
            };

            if (effectiveExisting) {
                const { error } = await supabase
                    .from('cash_collections')
                    .update(collectionData)
                    .eq('id', effectiveExisting.id);

                if (error) throw error;

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Cash collection updated successfully.');
            } else {
                // Insert new collection
                const { error } = await supabase
                    .from('cash_collections')
                    .insert([collectionData]);

                if (error) {
                    if (error.code === '23505') { // Unique constraint violation
                        Alert.alert('Duplicate Entry', `A cash collection for Month ${monthNum} already exists. Please edit the existing entry instead.`);
                        return;
                    }
                    throw error;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', `Cash collection recorded for Month ${monthNum} (${paymentStatus} payment).`);
            }

            onSuccess();
            handleClose();
        } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', err.message || 'Failed to record cash collection');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            handleClose();
        }
    };

    const formContent = (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: embedded ? 20 : 24, gap: 24, paddingBottom: embedded ? 40 : 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {embedded && (
                <TouchableOpacity onPress={handleBack} style={styles.embeddedBackRow}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#64748B">
                        <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </Svg>
                    <Text style={styles.embeddedBackText}>Back to History</Text>
                </TouchableOpacity>
            )}
                            {/* Group Info */}
                            <View style={styles.groupInfoCard}>
                                <Text style={styles.groupInfoLabel}>GROUP</Text>
                                <Text style={styles.groupInfoName}>{group.name}</Text>
                                <View style={styles.groupInfoRow}>
                                    <Text style={styles.groupInfoText}>Ticket: {membership.ticket_number || 'N/A'}</Text>
                                    <Text style={styles.groupInfoText}>
                                        Base EMI: {formatPaise(group.monthly_installment)}
                                    </Text>
                                </View>
                                {selectedMonthNum > 0 && expectedDuePaise != null && (
                                    <View style={styles.dueHighlightCard}>
                                        <Text style={styles.dueHighlightLabel}>PAYABLE INSTALLMENT</Text>
                                        <Text style={styles.dueHighlightValue}>{formatPaise(expectedDuePaise)}</Text>
                                    </View>
                                )}
                                {selectedMonthNum > 0 && expectedDuePaise == null && (
                                    <View style={styles.duePendingCard}>
                                        <Text style={styles.duePendingText}>
                                            Awaiting Auction #{selectedMonthNum} settlement before amount is available.
                                        </Text>
                                        {onRequestSettlement && (
                                            <TouchableOpacity
                                                style={styles.settlementLinkBtn}
                                                onPress={() => onRequestSettlement(selectedMonthNum)}
                                            >
                                                <Text style={styles.settlementLinkText}>Set Auction Settlement →</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>

            {/* Basic Info */}
            <Text style={styles.formSectionTitle}>Collection Details</Text>

            {auctionCycles.length > 0 && (
                <>
                    <Text style={styles.formSectionTitle}>
                        {effectiveExisting ? 'Auction Cycle' : 'Select Auction Cycle *'}
                    </Text>
                    {effectiveExisting ? (
                        <View style={styles.selectedCycleCard}>
                            <Text style={styles.selectedCycleTitle}>
                                Auction #{effectiveExisting.month_number}
                            </Text>
                            <Text style={styles.selectedCycleSub}>Month {effectiveExisting.month_number} collection</Text>
                        </View>
                    ) : (
                        <View style={styles.cycleList}>
                            {auctionCycles.map((auction) => {
                                const month = auction.auction_number!;
                                const existing = collectionByMonth.get(month);
                                const paidAmount = existing?.amount ?? 0;
                                const isCovered = isMonthFullyCollected(month);
                                const isSelected = monthNumber === String(month);
                                const auctionStatus = getAuctionStatusLabel(auction);
                                const cycleDue = getCycleDueAmount(
                                    month,
                                    group.monthly_installment,
                                    auctionCycles,
                                );
                                const paymentStatus = getCyclePaymentStatus(
                                    month,
                                    group.monthly_installment,
                                    auctionCycles,
                                    paidAmount,
                                );
                                const collectionStatus = getCollectionStatusLabel(
                                    paymentStatus,
                                    getCycleRemainingDue(month, group.monthly_installment, auctionCycles, paidAmount),
                                );
                                const isAwaitingAuction = cycleDue == null;
                                const isDisabled = isCovered || isAwaitingAuction;
                                return (
                                    <TouchableOpacity
                                        key={`cycle-${month}`}
                                        style={[
                                            styles.cycleCard,
                                            isSelected && styles.cycleCardActive,
                                            paymentStatus === 'partial' && styles.cycleCardPartial,
                                            isDisabled && styles.cycleCardDisabled,
                                        ]}
                                        disabled={isDisabled}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            if (existing && paymentStatus === 'partial') {
                                                setInlineEditing(existing);
                                            } else {
                                                setInlineEditing(null);
                                            }
                                            setMonthNumber(String(month));
                                        }}
                                        activeOpacity={0.75}
                                    >
                                        <View style={styles.cycleCardLeft}>
                                            <View style={[
                                                styles.cycleNumberBadge,
                                                isSelected && styles.cycleNumberBadgeActive,
                                            ]}>
                                                <Text style={[
                                                    styles.cycleNumberText,
                                                    isSelected && styles.cycleNumberTextActive,
                                                ]}>
                                                    {month}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.cycleTitle}>Auction #{month}</Text>
                                                {isAuctionScheduledDisplay(auction) && auction.scheduled_at ? (
                                                    <Text style={styles.cycleDate}>
                                                        {formatDateIST(auction.scheduled_at)}
                                                    </Text>
                                                ) : (
                                                    <Text style={styles.cycleDate}>Date not scheduled</Text>
                                                )}
                                                {cycleDue != null ? (
                                                    <Text style={styles.cycleDueAmount}>
                                                        Payable: {formatPaise(cycleDue)}
                                                    </Text>
                                                ) : (
                                                    <View style={{ gap: 4 }}>
                                                        <Text style={styles.cyclePendingText}>
                                                            Awaiting Auction #{month} settlement
                                                        </Text>
                                                        {onRequestSettlement && (
                                                            <TouchableOpacity onPress={() => onRequestSettlement(month)}>
                                                                <Text style={styles.cycleSettlementLink}>Set settlement →</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.cycleCardRight}>
                                            <View style={[styles.cycleStatusPill, { backgroundColor: auctionStatus.bg }]}>
                                                <Text style={[styles.cycleStatusText, { color: auctionStatus.color }]}>
                                                    {auctionStatus.label}
                                                </Text>
                                            </View>
                                            {collectionStatus && (
                                                <View style={[styles.cycleStatusPill, { backgroundColor: collectionStatus.bg }]}>
                                                    <Text style={[styles.cycleStatusText, { color: collectionStatus.color }]}>
                                                        {collectionStatus.label}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </>
            )}

            <View style={auctionCycles.length > 0 ? styles.inputGroup : styles.rowInputs}>
                {auctionCycles.length === 0 && (
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>MONTH NUMBER *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter instalment month number"
                            keyboardType="number-pad"
                            value={monthNumber}
                            onChangeText={setMonthNumber}
                            editable={!effectiveExisting}
                        />
                    </View>
                )}

                <View style={[styles.inputGroup, auctionCycles.length > 0 ? undefined : { flex: 1 }]}>
                    <Text style={styles.inputLabel}>AMOUNT (₹) *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter collected amount"
                        keyboardType="decimal-pad"
                        value={amount}
                        onChangeText={setAmount}
                    />
                </View>
            </View>

                            {/* Payment Status Indicator */}
                            {amount && (
                                <View style={[
                                    styles.statusBadge,
                                    paymentStatus === 'Full' && styles.statusBadgeFull,
                                    paymentStatus === 'Partial' && styles.statusBadgePartial,
                                ]}>
                                    <Text style={[
                                        styles.statusBadgeText,
                                        paymentStatus === 'Full' && styles.statusBadgeTextFull,
                                        paymentStatus === 'Partial' && styles.statusBadgeTextPartial,
                                    ]}>
                                        {paymentStatus} Payment
                                        {paymentStatus === 'Partial' && expectedDuePaise != null && ` (${formatPaise(Math.max(0, expectedDuePaise - amountInPaise))} remaining)`}
                                    </Text>
                                </View>
                            )}

                            {/* Denomination Breakdown */}
                            <Text style={styles.formSectionTitle}>Denomination Breakdown</Text>

                            <View style={styles.denominationGrid}>
                                {DENOMINATIONS.map(({ value, label }, idx) => {
                                    const stateMap: Record<number, [string, (v: string) => void]> = {
                                        500: [denom500, setDenom500],
                                        200: [denom200, setDenom200],
                                        100: [denom100, setDenom100],
                                        50: [denom50, setDenom50],
                                        20: [denom20, setDenom20],
                                        10: [denom10, setDenom10],
                                    };
                                    const [val, setVal] = stateMap[value];

                                    return (
                                        <View key={idx} style={styles.denominationItem}>
                                            <Text style={styles.denominationLabel}>{label} × </Text>
                                            <TextInput
                                                style={styles.denominationInput}
                                                placeholder="Enter note count"
                                                keyboardType="number-pad"
                                                value={val}
                                                onChangeText={setVal}
                                            />
                                            <Text style={styles.denominationTotal}>
                                                = ₹{((parseInt(val) || 0) * value).toFixed(0)}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            {/* Denomination Total vs Amount */}
                            <View style={[
                                styles.validationCard,
                                denominationMatches ? styles.validationCardSuccess : styles.validationCardError,
                            ]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.validationLabel}>Denomination Total</Text>
                                    <Text style={[
                                        styles.validationValue,
                                        denominationMatches ? styles.validationValueSuccess : styles.validationValueError,
                                    ]}>
                                        ₹{denominationTotal.toFixed(2)}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
                                    {denominationMatches ? (
                                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="#16A34A">
                                            <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                        </Svg>
                                    ) : (
                                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="#DC2626">
                                            <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                        </Svg>
                                    )}
                                </View>
                                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                    <Text style={styles.validationLabel}>Amount Entered</Text>
                                    <Text style={[
                                        styles.validationValue,
                                        denominationMatches ? styles.validationValueSuccess : styles.validationValueError,
                                    ]}>
                                        ₹{amountInRupees.toFixed(2)}
                                    </Text>
                                </View>
                            </View>

                            {!denominationMatches && amount && denominationTotal > 0 && (
                                <Text style={styles.validationError}>
                                    ⚠️ Denomination total must exactly match the amount entered
                                </Text>
                            )}

                            {/* Notes */}
                            <Text style={styles.formSectionTitle}>Internal Notes (Optional)</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>NOTES</Text>
                                <TextInput
                                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                                    placeholder="Enter internal collection notes (not visible to customer)"
                                    multiline
                                    value={notes}
                                    onChangeText={setNotes}
                                />
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[styles.submitBtn, (!isValid || loading) && styles.submitBtnDisabled]}
                                onPress={handleSave}
                                disabled={!isValid || loading}
                            >
                                <Text style={styles.submitBtnText}>
                                    {loading ? 'Saving...' : effectiveExisting ? 'Update Collection' : 'Record Collection'}
                                </Text>
                                {!loading && (
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
                                        <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                    </Svg>
                                )}
                            </TouchableOpacity>

            <View style={{ height: 40 }} />
        </ScrollView>
    );

    if (embedded) {
        if (!visible) return null;
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            >
                <View style={styles.embeddedHeader}>
                    <Text style={styles.embeddedTitle}>
                        {effectiveExisting ? 'Edit Cash Collection' : 'Record Cash Collection'}
                    </Text>
                </View>
                {formContent}
            </KeyboardAvoidingView>
        );
    }

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContentWrapper}>
                    <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {effectiveExisting ? 'Edit Cash Collection' : 'Record Cash Collection'}
                            </Text>
                            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#64748B">
                                    <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </Svg>
                            </TouchableOpacity>
                        </View>

                        {formContent}
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 28, 48, 0.4)', justifyContent: 'flex-end' },
    modalContentWrapper: { width: '100%', flex: 1, justifyContent: 'flex-end', paddingTop: 60 },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        flex: 1,
        shadowColor: '#01789E',
        shadowOffset: { width: 0, height: -20 },
        shadowOpacity: 0.2,
        shadowRadius: 40,
        elevation: 20,
    },
    modalHandle: {
        width: 48,
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 16,
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, color: '#164E63' },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    groupInfoCard: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    groupInfoLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', marginBottom: 4 },
    groupInfoName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30', marginBottom: 8 },
    groupInfoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    groupInfoText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#64748B' },
    dueHighlightCard: {
        marginTop: 12,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 12,
        padding: 12,
    },
    dueHighlightLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#005E7D', letterSpacing: 0.5 },
    dueHighlightValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#01789E', marginTop: 4 },
    duePendingCard: {
        marginTop: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 12,
    },
    duePendingText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', lineHeight: 18 },
    settlementLinkBtn: { marginTop: 10, alignSelf: 'flex-start' },
    settlementLinkText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#01789E' },
    cycleSettlementLink: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#01789E' },


    formSectionTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: '#0F172A',
        marginTop: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },

    inputGroup: { gap: 6 },
    rowInputs: { flexDirection: 'row', gap: 16 },
    inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B', marginLeft: 4 },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontFamily: 'Inter_400Regular',
        fontSize: 16,
        color: '#0B1C30',
    },

    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    statusBadgeFull: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
    statusBadgePartial: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
    statusBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
    statusBadgeTextFull: { color: '#16A34A' },
    statusBadgeTextPartial: { color: '#D97706' },

    denominationGrid: { gap: 12 },
    denominationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    denominationLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0B1C30', width: 60 },
    denominationInput: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontFamily: 'Inter_500Medium',
        fontSize: 16,
        color: '#0B1C30',
        textAlign: 'center',
    },
    denominationTotal: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#01789E', width: 80, textAlign: 'right' },

    validationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
    },
    validationCardSuccess: { backgroundColor: '#F0FDF4', borderColor: '#16A34A' },
    validationCardError: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
    validationLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748B', marginBottom: 4 },
    validationValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20 },
    validationValueSuccess: { color: '#16A34A' },
    validationValueError: { color: '#DC2626' },
    validationError: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#DC2626', textAlign: 'center' },

    submitBtn: {
        backgroundColor: '#01789E',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 16,
        marginTop: 16,
        shadowColor: '#01789E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    submitBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
    submitBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FFFFFF' },

    embeddedBackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    embeddedBackText: { fontFamily: 'Inter_500Medium', color: '#64748B', marginLeft: 8, fontSize: 14 },
    embeddedHeader: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
    },
    embeddedTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, color: '#164E63' },

    cycleList: { gap: 10 },
    cycleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 14,
    },
    cycleCardActive: {
        borderColor: '#01789E',
        backgroundColor: '#F0F9FF',
    },
    cycleCardDisabled: {
        opacity: 0.55,
        backgroundColor: '#F8FAFC',
    },
    cycleCardPartial: {
        borderColor: '#FDE68A',
        backgroundColor: '#FFFBEB',
    },
    cycleCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    cycleCardRight: { alignItems: 'flex-end', gap: 6 },
    cycleNumberBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cycleNumberBadgeActive: { backgroundColor: '#01789E' },
    cycleNumberText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#64748B' },
    cycleNumberTextActive: { color: '#FFFFFF' },
    cycleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0F172A' },
    cycleDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 2 },
    cycleDueAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#01789E', marginTop: 4 },
    cyclePendingText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8', marginTop: 4, fontStyle: 'italic' },
    cycleStatusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    cycleStatusText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.3 },
    cycleCollectedMark: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#16A34A' },
    selectedCycleCard: {
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 16,
        padding: 16,
    },
    selectedCycleTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#01789E' },
    selectedCycleSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748B', marginTop: 4 },
});
