import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiDeleteAdmin, apiGetAdmin } from '../../lib/api';

type ResourceType = 'group' | 'customer';

type DeletionImpact = {
    resourceType: ResourceType;
    id: string;
    name: string;
    secondaryLabel: string;
    confirmationValue: string;
    counts: Record<string, number>;
    warnings: string[];
    blockedReason: string | null;
};

type DeleteResult = {
    ok: boolean;
    deleted: Record<string, number>;
    warning?: string | null;
};

const countLabels: Record<string, string> = {
    memberships: 'Memberships',
    chitGroups: 'Chit groups joined',
    paymentSchedules: 'Instalment schedules',
    transactions: 'Payment transactions',
    cashCollections: 'Cash collections',
    collectionFollowups: 'Collection follow-ups',
    paymentOrders: 'Payment orders',
    prizeSettlements: 'Prize settlements',
    foreclosureRequests: 'Foreclosure requests',
    auctions: 'Auctions',
    bids: 'Auction bids',
    auctionParticipants: 'Auction participants',
    auctionParticipations: 'Auction participations',
    auctionEvents: 'Auction events',
    otpRequests: 'Login OTP records',
    deviceTokens: 'Registered devices',
};

export function DestructiveDeleteCard({
    resourceType,
    resourceId,
    onDeleted,
    inset = true,
}: {
    resourceType: ResourceType;
    resourceId: string;
    onDeleted: (result: DeleteResult) => void;
    inset?: boolean;
}) {
    const [visible, setVisible] = useState(false);
    const [impact, setImpact] = useState<DeletionImpact | null>(null);
    const [confirmation, setConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const label = resourceType === 'group' ? 'chit group' : 'customer';
    const routeName = resourceType === 'group' ? 'groups' : 'customers';

    const close = () => {
        if (deleting) return;
        setVisible(false);
        setImpact(null);
        setConfirmation('');
        setError('');
    };

    const open = async () => {
        setVisible(true);
        setLoading(true);
        setError('');
        setConfirmation('');
        try {
            const nextImpact = await apiGetAdmin<DeletionImpact>(`/api/admin/${routeName}/${resourceId}/deletion-impact`);
            setImpact(nextImpact);
        } catch (nextError: any) {
            setError(nextError?.message || `Could not load ${label} deletion details.`);
        } finally {
            setLoading(false);
        }
    };

    const remove = async () => {
        if (!impact || impact.blockedReason || confirmation.trim() !== impact.confirmationValue || deleting) return;
        setDeleting(true);
        setError('');
        try {
            const result = await apiDeleteAdmin<DeleteResult>(`/api/admin/${routeName}/${resourceId}`, {
                confirmation: confirmation.trim(),
            });
            setVisible(false);
            onDeleted(result);
        } catch (nextError: any) {
            setError(nextError?.message || `Could not delete ${label}.`);
        } finally {
            setDeleting(false);
        }
    };

    const countEntries = impact
        ? Object.entries(impact.counts).filter(([, value]) => Number(value) > 0)
        : [];
    const confirmed = Boolean(impact) && confirmation.trim() === impact?.confirmationValue;

    return (
        <>
            <View style={[styles.card, !inset && styles.cardFlush]}>
                <Text style={styles.eyebrow}>DANGER ZONE</Text>
                <Text style={styles.title}>Delete {label}</Text>
                <Text style={styles.description}>
                    Permanently remove this {label} and all records that belong to it. Review the impact before confirming.
                </Text>
                <TouchableOpacity
                    style={styles.openButton}
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${label}`}
                >
                    <Text style={styles.openButtonText}>REVIEW AND DELETE</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            onPress={close}
                            disabled={deleting}
                            style={styles.closeButton}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel deletion"
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Delete {label}</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <KeyboardAvoidingView
                        style={styles.flex}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                            {loading ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="large" color="#B91C1C" />
                                    <Text style={styles.loadingText}>Calculating deletion impact…</Text>
                                </View>
                            ) : impact ? (
                                <>
                                    <View style={styles.identityCard}>
                                        <Text style={styles.identityName}>{impact.name}</Text>
                                        <Text style={styles.identityCode}>{impact.secondaryLabel}</Text>
                                    </View>

                                    <View style={styles.warningCard}>
                                        {impact.warnings.map((warning) => (
                                            <Text key={warning} style={styles.warningText}>• {warning}</Text>
                                        ))}
                                    </View>

                                    {countEntries.length > 0 && (
                                        <View style={styles.impactCard}>
                                            <Text style={styles.impactTitle}>Records that will be deleted</Text>
                                            {countEntries.map(([key, value]) => (
                                                <View key={key} style={styles.countRow}>
                                                    <Text style={styles.countLabel}>{countLabels[key] || key}</Text>
                                                    <Text style={styles.countValue}>{value.toLocaleString('en-IN')}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {impact.blockedReason ? (
                                        <View style={styles.blockedCard}>
                                            <Text style={styles.blockedTitle}>Deletion blocked</Text>
                                            <Text style={styles.blockedText}>{impact.blockedReason}</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.confirmArea}>
                                            <Text style={styles.confirmLabel}>TYPE TO CONFIRM</Text>
                                            <Text style={styles.confirmHelp}>
                                                Enter <Text style={styles.confirmValue}>{impact.confirmationValue}</Text> exactly.
                                            </Text>
                                            <TextInput
                                                style={styles.input}
                                                value={confirmation}
                                                onChangeText={setConfirmation}
                                                placeholder={`Enter ${resourceType === 'group' ? 'group name' : 'customer ID'}`}
                                                placeholderTextColor="#94A3B8"
                                                autoCapitalize={resourceType === 'customer' ? 'characters' : 'none'}
                                                autoCorrect={false}
                                                editable={!deleting}
                                                accessibilityLabel={`Type ${impact.confirmationValue} to confirm deletion`}
                                            />
                                            <TouchableOpacity
                                                style={[styles.deleteButton, (!confirmed || deleting) && styles.disabledButton]}
                                                onPress={remove}
                                                disabled={!confirmed || deleting}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Permanently delete ${label}`}
                                            >
                                                {deleting ? (
                                                    <ActivityIndicator color="#FFFFFF" />
                                                ) : (
                                                    <Text style={styles.deleteButtonText}>DELETE PERMANENTLY</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </>
                            ) : null}

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    card: {
        backgroundColor: '#FFF7F7',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 18,
        padding: 18,
        marginHorizontal: 20,
        marginTop: 18,
        marginBottom: 24,
    },
    cardFlush: { marginHorizontal: 0 },
    eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1, color: '#B91C1C' },
    title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#7F1D1D', marginTop: 5 },
    description: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: '#7F1D1D', marginTop: 6 },
    openButton: { borderWidth: 1, borderColor: '#DC2626', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
    openButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.5, color: '#B91C1C' },
    modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    modalHeader: { height: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
    closeButton: { width: 72, paddingVertical: 10 },
    closeButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#475569' },
    modalTitle: { flex: 1, textAlign: 'center', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0F172A' },
    headerSpacer: { width: 72 },
    modalContent: { padding: 20, paddingBottom: 48 },
    loadingBox: { alignItems: 'center', paddingVertical: 80 },
    loadingText: { marginTop: 14, fontFamily: 'Inter_500Medium', color: '#64748B' },
    identityCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 18 },
    identityName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#0F172A' },
    identityCode: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B', marginTop: 4 },
    warningCard: { backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', padding: 16, marginTop: 14, gap: 8 },
    warningText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#991B1B' },
    impactCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 18, marginTop: 14 },
    impactTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#0F172A', marginBottom: 10 },
    countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
    countLabel: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#475569' },
    countValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#0F172A', marginLeft: 12 },
    blockedCard: { backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', padding: 16, marginTop: 14 },
    blockedTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#92400E' },
    blockedText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: '#92400E', marginTop: 5 },
    confirmArea: { marginTop: 18 },
    confirmLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.7, color: '#475569' },
    confirmHelp: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: '#64748B', marginTop: 5 },
    confirmValue: { fontFamily: 'Inter_700Bold', color: '#0F172A' },
    input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14, fontFamily: 'Inter_500Medium', fontSize: 15, color: '#0F172A', marginTop: 10 },
    deleteButton: { backgroundColor: '#B91C1C', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    disabledButton: { opacity: 0.38 },
    deleteButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.5, color: '#FFFFFF' },
    errorText: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginTop: 14, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#B91C1C' },
});
