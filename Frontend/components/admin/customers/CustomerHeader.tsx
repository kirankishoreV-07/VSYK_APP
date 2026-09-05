import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Customer } from './types';
import { deriveRiskLevel, formatDateIST } from './utils';
import { AdminColors, softElevation } from './adminStyles';

interface CustomerHeaderProps {
    customer: Customer;
    overdueCount: number;
    onTimePercentage: number;
}

export function CustomerHeader({ customer, overdueCount, onTimePercentage }: CustomerHeaderProps) {
    const riskLevel = deriveRiskLevel(overdueCount, onTimePercentage);
    const isVerified = customer.kyc_status === 'verified';
    const riskLabel = riskLevel === 'low' ? 'Low Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'High Risk';

    const canCall = !!customer.phone;
    const canEmail = !!customer.email;

    const handleCall = async () => {
        if (!customer.phone) return;
        const url = `tel:${customer.phone}`;
        if (await Linking.canOpenURL(url)) Linking.openURL(url);
    };

    const handleEmail = async () => {
        if (!customer.email) return;
        const url = `mailto:${customer.email}`;
        if (await Linking.canOpenURL(url)) Linking.openURL(url);
    };

    const initials = customer.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    return (
        <View style={styles.container}>
            <View style={styles.topRow}>
                <View style={styles.identityRow}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.infoColumn}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>{customer.full_name}</Text>
                            {isVerified && (
                                <View style={styles.badgeVerified}>
                                    <Text style={styles.badgeVerifiedText}>VERIFIED</Text>
                                </View>
                            )}
                            <View style={[styles.badgeRisk, riskLevel !== 'low' && styles.badgeRiskWarn]}>
                                <Text style={[styles.badgeRiskText, riskLevel !== 'low' && styles.badgeRiskTextWarn]}>
                                    {riskLabel.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.meta}>
                            ID: <Text style={styles.metaBold}>{customer.customer_id}</Text> • {customer.customer_type}
                        </Text>
                        <View style={styles.contactRow}>
                            <View style={styles.contactItem}>
                                <Svg width={14} height={14} viewBox="0 0 24 24" fill={AdminColors.slate500}>
                                    <Path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
                                </Svg>
                                <Text style={styles.contactText}>Since {formatDateIST(customer.created_at)}</Text>
                            </View>
                            {customer.phone ? (
                                <View style={styles.contactItem}>
                                    <Svg width={14} height={14} viewBox="0 0 24 24" fill={AdminColors.slate500}>
                                        <Path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </Svg>
                                    <Text style={styles.contactText}>{customer.phone}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.emailBtn, !canEmail && styles.btnDisabled]}
                    onPress={handleEmail}
                    disabled={!canEmail}
                >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill={AdminColors.primary}>
                        <Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
                    </Svg>
                    <Text style={styles.emailBtnText}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.callBtn, !canCall && styles.btnDisabled]}
                    onPress={handleCall}
                    disabled={!canCall}
                >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="#FFFFFF">
                        <Path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </Svg>
                    <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginHorizontal: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        ...softElevation,
    },
    topRow: {
        marginBottom: 16,
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: AdminColors.cyan50,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 20,
        color: AdminColors.primaryContainer,
    },
    infoColumn: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    name: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 20,
        color: AdminColors.textPrimary,
    },
    badgeVerified: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 100,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    badgeVerifiedText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: '#15803D',
        letterSpacing: 0.5,
    },
    badgeRisk: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 100,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    badgeRiskWarn: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FEF3C7',
    },
    badgeRiskText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: '#15803D',
        letterSpacing: 0.5,
    },
    badgeRiskTextWarn: {
        color: '#B45309',
    },
    meta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: AdminColors.slate500,
        marginBottom: 6,
    },
    metaBold: {
        fontFamily: 'Inter_500Medium',
        color: AdminColors.textPrimary,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    contactText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#475569',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    emailBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AdminColors.primary,
    },
    emailBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: AdminColors.primary,
    },
    callBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: AdminColors.primary,
    },
    callBtnText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    btnDisabled: {
        opacity: 0.45,
    },
});