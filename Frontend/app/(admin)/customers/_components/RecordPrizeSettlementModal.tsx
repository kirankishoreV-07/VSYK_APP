import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
    TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { apiPostAdmin } from '../../../../lib/api';
import { formatPaise } from './utils';
import type { AuctionPrizeSettlement } from './types';

const DENOMINATIONS = [
    { value: 500, label: '₹500' },
    { value: 200, label: '₹200' },
    { value: 100, label: '₹100' },
    { value: 50, label: '₹50' },
    { value: 20, label: '₹20' },
    { value: 10, label: '₹10' },
];

interface WinnerRef {
    id: string;
    customers?: { full_name?: string | null } | null;
}

interface AuctionForPrize {
    id: string;
    auction_number: number | null;
    winner_prize_amount?: number | null;
    winner_member_id?: string | null;
    chit_group_id: string;
}

interface GroupRef {
    id: string;
    accounting_type?: 'accounted' | 'unaccounted' | null;
    name?: string;
}

interface RecordPrizeSettlementModalProps {
    visible: boolean;
    onClose: () => void;
    onSaved: () => void;
    auction: AuctionForPrize | null;
    group: GroupRef | null;
    winner: WinnerRef | null; // pre-resolved winner member
    existingSettlements?: AuctionPrizeSettlement[];
    /** For embedded use inside another sheet */
    embedded?: boolean;
}

export function RecordPrizeSettlementModal({
    visible,
    onClose,
    onSaved,
    auction,
    group,
    winner,
    existingSettlements = [],
    embedded = false,
}: RecordPrizeSettlementModalProps) {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Denoms (only relevant / validated for unaccounted)
    const [denoms, setDenoms] = useState<Record<number, string>>({
        500: '0', 200: '0', 100: '0', 50: '0', 20: '0', 10: '0',
    });

    const isUnaccounted = group?.accounting_type === 'unaccounted';
    const totalPrize = auction?.winner_prize_amount || 0;

    // Compute already settled for this auction + winner
    const alreadySettled = useMemo(() => {
        if (!auction || !winner) return 0;
        return existingSettlements
            .filter(s => s.auction_id === auction.id && s.chit_member_id === winner.id)
            .reduce((sum, s) => sum + (s.amount || 0), 0);
    }, [existingSettlements, auction, winner]);

    const remaining = Math.max(0, totalPrize - alreadySettled);
    const currentInput = Math.max(0, Math.round(Number(amount || 0) * 100));
    const wouldBeTotal = alreadySettled + currentInput;
    const isFullThisTime = currentInput >= remaining && remaining > 0;

    // Real-time denom total (for unaccounted validation)
    const denomTotal = useMemo(() => {
        return Object.entries(denoms).reduce((sum, [k, v]) => {
            return sum + (parseInt(v || '0', 10) * parseInt(k, 10) * 100);
        }, 0);
    }, [denoms]);

    const denomValid = !isUnaccounted || denomTotal === currentInput;

    useEffect(() => {
        if (!visible) {
            // reset form when closing
            setAmount('');
            setNotes('');
            setDenoms({ 500: '0', 200: '0', 100: '0', 50: '0', 20: '0', 10: '0' });
        }
    }, [visible]);

    const handleDenomChange = (denom: number, val: string) => {
        setDenoms(prev => ({ ...prev, [denom]: val.replace(/[^0-9]/g, '') }));
    };

    const handleSave = async () => {
        if (!auction || !winner || !group) return;

        if (!currentInput || currentInput <= 0) {
            Alert.alert('Invalid amount', 'Enter a positive settlement amount.');
            return;
        }
        if (currentInput > remaining) {
            Alert.alert('Over settlement', `You can settle at most the remaining ₹${(remaining / 100).toLocaleString('en-IN')}.`);
            return;
        }
        if (isUnaccounted && !denomValid) {
            Alert.alert('Denomination mismatch', 'For cash (unaccounted) groups the sum of denominations must exactly equal the amount entered.');
            return;
        }

        setSaving(true);
        try {
            await apiPostAdmin('/api/payments/admin/prize-payout', {
                auctionId: auction.id,
                chitMemberId: winner.id,
                amount: currentInput,
                notes: notes.trim() || null,
                denominations: {
                    500: isUnaccounted ? parseInt(denoms[500] || '0', 10) : 0,
                    200: isUnaccounted ? parseInt(denoms[200] || '0', 10) : 0,
                    100: isUnaccounted ? parseInt(denoms[100] || '0', 10) : 0,
                    50: isUnaccounted ? parseInt(denoms[50] || '0', 10) : 0,
                    20: isUnaccounted ? parseInt(denoms[20] || '0', 10) : 0,
                    10: isUnaccounted ? parseInt(denoms[10] || '0', 10) : 0,
                },
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const settledNow = (alreadySettled + currentInput) / 100;
            const prizeRupees = totalPrize / 100;

            Alert.alert(
                'Prize Settlement Recorded',
                `Recorded ₹${(currentInput / 100).toLocaleString('en-IN')} for Auction #${auction.auction_number}.\n` +
                `Total settled for this prize: ₹${settledNow.toLocaleString('en-IN')} of ₹${prizeRupees.toLocaleString('en-IN')}.` +
                (isFullThisTime ? '\nThis completes the prize settlement for the winner.' : '')
            );

            onSaved();
            onClose();
        } catch (err: any) {
            console.error(err);
            Alert.alert('Error', err?.message || 'Failed to record prize settlement.');
        } finally {
            setSaving(false);
        }
    };

    if (!auction || !winner) return null;

    const winnerName = winner.customers?.full_name || 'Winner';
    const prizeDisplay = (totalPrize / 100).toLocaleString('en-IN');
    const settledDisplay = (alreadySettled / 100).toLocaleString('en-IN');
    const remainingDisplay = (remaining / 100).toLocaleString('en-IN');

    const content = (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
                        <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </Svg>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.title}>Record Prize Settlement</Text>
                    <Text style={styles.subtitle}>Auction #{auction.auction_number} · {group?.name}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* Target + Progress */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Winner</Text>
                    <Text style={styles.winnerName}>{winnerName}</Text>

                    <View style={styles.prizeRow}>
                        <Text style={styles.infoLabel}>Total Prize</Text>
                        <Text style={styles.prizeValue}>₹{prizeDisplay}</Text>
                    </View>

                    <View style={styles.progressBar}>
                        <View 
                            style={[
                                styles.progressFill, 
                                { width: totalPrize > 0 ? `${Math.min(100, (alreadySettled / totalPrize) * 100)}%` : '0%' }
                            ]} 
                        />
                    </View>

                    <View style={styles.progressLabels}>
                        <Text style={styles.progressText}>Settled: ₹{settledDisplay}</Text>
                        <Text style={[styles.progressText, { color: remaining > 0 ? '#DC2626' : '#16A34A' }]}>
                            Remaining: ₹{remainingDisplay}
                        </Text>
                    </View>

                    {alreadySettled > 0 && (
                        <Text style={styles.partialNote}>
                            {remaining <= 0 
                                ? 'Fully settled for this winner.' 
                                : 'Partial settlement already recorded. You can add more.'}
                        </Text>
                    )}
                </View>

                {/* Amount input */}
                <Text style={styles.sectionTitle}>This Payout Amount (₹)</Text>
                <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Enter payout amount"
                    placeholderTextColor="#94A3B8"
                />
                <Text style={styles.hint}>
                    Enter full remaining or a partial amount. Max: ₹{remainingDisplay}
                </Text>

                {/* Denominations (unaccounted only) */}
                {isUnaccounted && (
                    <>
                        <Text style={styles.sectionTitle}>Cash Denominations (must match amount exactly)</Text>
                        <View style={styles.denomGrid}>
                            {DENOMINATIONS.map(({ value, label }) => (
                                <View key={value} style={styles.denomField}>
                                    <Text style={styles.denomLabel}>{label}</Text>
                                    <TextInput
                                        style={styles.denomInput}
                                        keyboardType="numeric"
                                        value={denoms[value]}
                                        onChangeText={(v) => handleDenomChange(value, v)}
                                        placeholder="Enter note count"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            ))}
                        </View>
                        <Text style={[styles.denomTotal, denomValid ? styles.denomOk : styles.denomBad]}>
                            Denoms total: ₹{(denomTotal / 100).toLocaleString('en-IN')} 
                            {denomValid ? ' ✓ Matches' : ' (does not match entered amount)'}
                        </Text>
                    </>
                )}

                {/* Notes / Reference */}
                <Text style={styles.sectionTitle}>Notes / Reference (optional)</Text>
                <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder={isUnaccounted ? "Enter cash handover reference (optional)" : "Enter bank, UPI, or cheque reference (optional)"}
                    placeholderTextColor="#94A3B8"
                    multiline
                />

                <TouchableOpacity
                    style={[styles.saveBtn, (saving || !currentInput || (isUnaccounted && !denomValid)) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving || !currentInput || (isUnaccounted && !denomValid)}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.saveBtnText}>
                            {isFullThisTime ? 'RECORD FULL SETTLEMENT' : 'RECORD PARTIAL SETTLEMENT'}
                        </Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.footerNote}>
                    Both admin and the winning member will see the updated settled / pending amounts immediately.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );

    if (embedded) {
        return content;
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            {content}
        </Modal>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
    subtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
    scroll: { padding: 20, paddingBottom: 60 },
    infoCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    infoLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#166534', marginBottom: 4 },
    winnerName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30', marginBottom: 12 },
    prizeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    prizeValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#10B981' },
    progressBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#10B981',
    },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#166534' },
    partialNote: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#92400E', marginTop: 8 },
    sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#0F172A', marginBottom: 8, marginTop: 12 },
    amountInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 22,
        color: '#0B1C30',
    },
    hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 6 },
    denomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    denomField: { width: '30%', minWidth: 90 },
    denomLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748B', marginBottom: 4 },
    denomInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        color: '#0B1C30',
    },
    denomTotal: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 8 },
    denomOk: { color: '#16A34A' },
    denomBad: { color: '#DC2626' },
    notesInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: 'Inter_500Medium',
        fontSize: 15,
        color: '#0B1C30',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    saveBtn: {
        backgroundColor: '#01789E',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 24,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FFFFFF', letterSpacing: 0.5 },
    footerNote: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 18,
    },
});
