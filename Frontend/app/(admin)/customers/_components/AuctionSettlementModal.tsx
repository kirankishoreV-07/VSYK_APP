import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
    TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../../lib/supabase';
import { apiPostAdmin } from '../../../../lib/api';
import type { Auction } from './types';

type SettlementMember = {
    id: string;
    customer_id?: string | null;
    participation_share?: number | null;
    customers?: { full_name?: string | null } | null;
};

type SettlementGroup = {
    id: string;
    value?: number | null;
    emi_amount?: number | null;
    monthly_installment?: number | null;
    no_of_installments?: number | null;
    duration_months?: number | null;
    capacity?: number | null;
    agent_commission_rate?: number | null;
};

interface AuctionSettlementModalProps {
    visible: boolean;
    auction: Auction | null;
    group: SettlementGroup | null;
    members: SettlementMember[];
    memberCount: number;
    totalShares: number;
    onClose: () => void;
    onSaved: () => void;
}

export function AuctionSettlementModal({
    visible,
    auction,
    group,
    members,
    memberCount,
    totalShares,
    onClose,
    onSaved,
}: AuctionSettlementModalProps) {
    const [winnerId, setWinnerId] = useState('');
    const [installment, setInstallment] = useState('');
    const [discount, setDiscount] = useState('');
    const [dividend, setDividend] = useState('');
    const [finalDue, setFinalDue] = useState('');
    const [prize, setPrize] = useState('');
    const [savings, setSavings] = useState('');
    const [saving, setSaving] = useState(false);
    const [manualPayable, setManualPayable] = useState(false);
    const [loadingBids, setLoadingBids] = useState(false);
    const initializedFor = useRef<string | null>(null);

    const calculatedEmi = ((Number(group?.value) || 0) / (Number(group?.no_of_installments) || Number(group?.duration_months) || 1));
    const baseEmi = (Number(group?.emi_amount) || Number(group?.monthly_installment) || calculatedEmi) / 100;
    const commissionRate = Math.min(Math.max(Number(group?.agent_commission_rate ?? 5), 0), 100) / 100;
    const shareCount = totalShares > 0 ? totalShares : (memberCount > 0 ? memberCount : Number(group?.capacity) || 50);
    const chitValueRupees = (Number(group?.value || 0) / 100);
    const isCompleted = auction?.status === 'completed';

    useEffect(() => {
        if (!visible || !auction?.id) return;
        if (initializedFor.current === auction.id) return;
        initializedFor.current = auction.id;
        setManualPayable(false);
        setLoadingBids(true);

        const load = async () => {
            setWinnerId(auction.winner_member_id || '');
            const savedDiscount = auction.discount_amount ? String(auction.discount_amount / 100) : '';
            const savedFinalDue = auction.final_due_amount ? String(Math.round(auction.final_due_amount / 100)) : '';

            try {
                const { data: topBidRow } = await supabase
                    .from('auction_bids')
                    .select('bid_amount, customer_id')
                    .eq('auction_id', auction.id)
                    .eq('is_retracted', false)
                    .order('bid_amount', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (topBidRow && topBidRow.bid_amount > 0) {
                    setDiscount(String(topBidRow.bid_amount / 100));
                    if (topBidRow.customer_id) {
                        const winnerMember = members.find(m => m.customer_id === topBidRow.customer_id);
                        if (winnerMember) setWinnerId(winnerMember.id);
                    }
                } else if (savedDiscount) {
                    setDiscount(savedDiscount);
                } else {
                    setDiscount('');
                }
            } catch {
                setDiscount(savedDiscount);
            }

            if (savedFinalDue && isCompleted) {
                setFinalDue(savedFinalDue);
                if (!savedDiscount) setManualPayable(true);
            }

            setLoadingBids(false);
        };

        load();
    }, [visible, auction, members, isCompleted]);

    useEffect(() => {
        if (!visible) {
            initializedFor.current = null;
        }
    }, [visible]);

    useEffect(() => {
        const roundedInstallment = Math.round(baseEmi || 0);
        if (!installment || Number(installment) !== roundedInstallment) {
            setInstallment(String(roundedInstallment));
        }

        if (manualPayable) return;

        const installmentVal = Number(installment || baseEmi || 0);
        const bidAmount = Number(discount || 0);
        const commission = chitValueRupees * commissionRate;
        const dividendPool = Math.max(bidAmount - commission, 0);
        const dividendPerShare = shareCount > 0 ? dividendPool / shareCount : 0;
        const payableInstallment = Math.max(installmentVal - dividendPerShare, 0);
        const prizeAmount = Math.max(chitValueRupees - bidAmount, 0);
        const savingsPct = installmentVal > 0 ? (dividendPerShare / installmentVal) * 100 : 0;

        setDividend(String(Math.round(dividendPerShare)));
        setFinalDue(String(Math.round(payableInstallment)));
        setPrize(String(Math.round(prizeAmount)));
        setSavings(savingsPct.toFixed(2));
    }, [discount, chitValueRupees, shareCount, baseEmi, installment, manualPayable, visible]);

    const handleSave = async () => {
        if (!auction?.id || !group?.id) return;

        const finalDueNum = Number(finalDue || 0);
        if (!finalDueNum || finalDueNum <= 0) {
            Alert.alert('Missing amount', 'Enter a bid/discount amount or set the payable installment manually.');
            return;
        }

        const toPaise = (val: string) => Math.max(0, Math.round(Number(val || 0) * 100));
        const finalDuePaise = toPaise(finalDue);
        const dividendPaise = toPaise(dividend);
        const auctionNumber = auction.auction_number;

        setSaving(true);
        try {
            const winnerMember = members.find((m) => m.id === winnerId);
            const winnerName = winnerMember?.customers?.full_name?.trim() || null;

            const applyResult = await apiPostAdmin<{ ok: boolean; updated: number }>(
                '/api/auctions/apply-settlement',
                {
                    auctionId: auction.id,
                    winnerMemberId: winnerId || null,
                    winnerName,
                    currentBid: toPaise(discount),
                    installmentDue: toPaise(String(baseEmi || 0)),
                    dividendAmount: dividendPaise,
                    discountAmount: toPaise(discount),
                    finalDueAmount: finalDuePaise,
                    winnerPrizeAmount: toPaise(prize),
                },
            );

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Settlement Saved',
                `Auction #${auctionNumber} settled for ${applyResult.updated} member${applyResult.updated === 1 ? '' : 's'}. Payable installment set to ₹${Math.round(finalDuePaise / 100).toLocaleString('en-IN')}.`,
            );
            onSaved();

            try {
                await apiPostAdmin('/api/auctions/notify-installments', {
                    auctionId: auction.id,
                    message: `Installment for Auction #${auctionNumber || ''} is due. Please pay now.`,
                });
            } catch {
                // non-critical
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to save settlement.');
        } finally {
            setSaving(false);
        }
    };

    const subtitle = useMemo(() => {
        if (!auction) return '';
        if (isCompleted) return 'Update settlement values for this auction cycle.';
        return 'Record results for an auction held outside the app. This unlocks cash/payment collection for this cycle.';
    }, [auction, isCompleted]);

    if (!auction) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
                            <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </Svg>
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={styles.title}>Set Auction Settlement</Text>
                        <Text style={styles.subtitle}>Auction #{auction.auction_number}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <View style={styles.infoCard}>
                        <Text style={styles.infoText}>{subtitle}</Text>
                    </View>

                    <Text style={styles.sectionTitle}>Winner Selection</Text>
                    {members.length === 0 ? (
                        <Text style={styles.emptyNote}>No members enrolled yet.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                            {members.map((m, idx) => {
                                const name = m.customers?.full_name || `Member #${idx + 1}`;
                                const isActive = winnerId === m.id;
                                return (
                                    <TouchableOpacity
                                        key={m.id}
                                        style={[styles.winnerChip, isActive && styles.winnerChipActive]}
                                        onPress={() => setWinnerId(m.id)}
                                    >
                                        <Text style={[styles.winnerChipText, isActive && styles.winnerChipTextActive]}>{name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}

                    <Text style={styles.sectionTitle}>Auction Inputs</Text>
                    {loadingBids ? (
                        <ActivityIndicator color="#005E7D" style={{ marginBottom: 16 }} />
                    ) : discount && Number(discount) > 0 ? (
                        <View style={styles.autoFillBanner}>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="#16A34A">
                                <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </Svg>
                            <Text style={styles.autoFillText}>
                                Auto-filled from highest bid when available · Edit bid or payable below
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.grid}>
                        <View style={styles.field}>
                            <Text style={styles.label}>Monthly Installment (₹)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={installment} editable={false} />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Bid Amount / Discount (₹)</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={discount}
                                onChangeText={(v) => { setManualPayable(false); setDiscount(v); }}
                                placeholder="Enter winning discount amount"
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Dividend per Person (₹)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={dividend} editable={false} />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Payable Installment (₹) *</Text>
                            <TextInput
                                style={[styles.input, styles.inputHighlight]}
                                keyboardType="numeric"
                                value={finalDue}
                                onChangeText={(v) => { setManualPayable(true); setFinalDue(v); }}
                                placeholder="Enter payable instalment amount"
                            />
                            <Text style={styles.fieldHint}>Used for cash collection & online payments</Text>
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Monthly Savings (%)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={savings} editable={false} />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Bidder Prize (₹)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={prize} editable={false} />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator color="#FFFFFF" />
                            : <Text style={styles.saveBtnText}>{isCompleted ? 'UPDATE SETTLEMENT' : 'SAVE SETTLEMENT'}</Text>
                        }
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
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
    scroll: { padding: 20, paddingBottom: 40 },
    infoCard: {
        backgroundColor: '#F0F9FF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    infoText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#005E7D', lineHeight: 20 },
    sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#0F172A', marginBottom: 12 },
    emptyNote: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', marginBottom: 20 },
    winnerChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 100,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    winnerChipActive: { backgroundColor: '#F0F9FF', borderColor: '#005E7D' },
    winnerChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },
    winnerChipTextActive: { color: '#005E7D' },
    autoFillBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F0FDF4',
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    autoFillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#16A34A', flex: 1 },
    grid: { gap: 12 },
    field: { gap: 6 },
    label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748B', letterSpacing: 0.4 },
    fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A3B8' },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: 'Inter_500Medium',
        fontSize: 15,
        color: '#0F172A',
    },
    inputHighlight: {
        backgroundColor: '#F0F9FF',
        borderColor: '#BAE6FD',
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 18,
        color: '#01789E',
    },
    saveBtn: {
        backgroundColor: '#01789E',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 24,
    },
    saveBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FFFFFF', letterSpacing: 0.5 },
});
