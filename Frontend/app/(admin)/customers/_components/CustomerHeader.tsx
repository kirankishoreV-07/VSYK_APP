import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import type { Customer } from './types';
import { deriveRiskLevel, formatDateIST } from './utils';
import { AdminColors, getBadgeStyle, AdminBadgeStyles } from './adminStyles';

interface CustomerHeaderProps {
    customer: Customer;
    overdueCount: number;
    onTimePercentage: number;
}

export function CustomerHeader({ customer, overdueCount, onTimePercentage }: CustomerHeaderProps) {
    const riskLevel = deriveRiskLevel(overdueCount, onTimePercentage);
    const kycBadge = getBadgeStyle(customer.kyc_status as any);
    const riskBadge = getBadgeStyle(riskLevel === 'low' ? 'verified' : riskLevel === 'medium' ? 'pending' : 'rejected');

    const canCall = !!customer.phone;
    const canEmail = !!customer.email;

    const handleCall = async () => {
        if (!customer.phone) return;
        const url = `tel:${customer.phone}`;
        if (await Linking.canOpenURL(url)) {
            Linking.openURL(url);
        }
    };

    const handleEmail = async () => {
        if (!customer.email) return;
        const url = `mailto:${customer.email}`;
        if (await Linking.canOpenURL(url)) {
            Linking.openURL(url);
        }
    };

    return (
        <View style={styles.container}>
            {/* Avatar and basic info */}
            <View style={styles.row}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {customer.full_name.substring(0, 2).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.infoColumn}>
                    <Text style={styles.name}>{customer.full_name}</Text>
                    <Text style={styles.meta}>
                        ID: {customer.customer_id} • {customer.customer_type}
                    </Text>
                    <Text style={styles.contact}>
                        {customer.phone || 'No phone'}
                        {customer.email ? ` • ${customer.email}` : ''}
                    </Text>
                    <Text style={styles.memberSince}>Member since {formatDateIST(customer.created_at)}</Text>
                </View>
            </View>

            {/* Badges row */}
            <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: kycBadge.backgroundColor, borderColor: kycBadge.borderColor, borderWidth: 1 }]}>
                    <Text style={[styles.badgeText, { color: kycBadge.color }]}>
                        KYC: {customer.kyc_status.toUpperCase()}
                    </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: riskBadge.backgroundColor, borderColor: riskBadge.borderColor, borderWidth: 1 }]}>
                    <Text style={[styles.badgeText, { color: riskBadge.color }]}>
                        Risk: {riskLevel.toUpperCase()} (Derived)
                    </Text>
                </View>
            </View>

            {/* Quick actions */}
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionBtn, !canCall && styles.actionBtnDisabled]}
                    onPress={handleCall}
                    disabled={!canCall}
                >
                    <Text style={styles.actionBtnText}>{canCall ? '📞 Call' : '📞 No Phone'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, !canEmail && styles.actionBtnDisabled]}
                    onPress={handleEmail}
                    disabled={!canEmail}
                >
                    <Text style={styles.actionBtnText}>{canEmail ? '✉️ Email' : '✉️ No Email'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#0EA5E9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 24,
        color: '#FFFFFF',
    },
    infoColumn: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontFamily: 'Inter_700Bold',
        fontSize: 20,
        color: '#0B1C30',
        marginBottom: 4,
    },
    meta: {
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: '#64748B',
        marginBottom: 2,
    },
    contact: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        color: '#64748B',
        marginBottom: 2,
    },
    memberSince: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#94A3B8',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    badgeText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        backgroundColor: '#0EA5E9',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    actionBtnDisabled: {
        backgroundColor: '#E2E8F0',
    },
    actionBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
});
