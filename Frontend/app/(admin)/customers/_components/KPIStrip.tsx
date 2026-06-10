import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AdminColors, softElevation } from './adminStyles';

export interface HubKPICounts {
    groups: number;
    payments: number;
    auctions: number;
}

interface KPIStripProps {
    counts: HubKPICounts;
    onNavigateGroups: () => void;
    onNavigatePayments: () => void;
    onNavigateAuctions: () => void;
    onNavigateDiagnostics: () => void;
}

function KPICard({
    icon,
    title,
    subtitle,
    onPress,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.kpiCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.iconBox}>{icon}</View>
            <Text style={styles.kpiTitle}>{title}</Text>
            <Text style={styles.kpiSubtitle}>{subtitle}</Text>
        </TouchableOpacity>
    );
}

export function KPIStrip({
    counts,
    onNavigateGroups,
    onNavigatePayments,
    onNavigateAuctions,
    onNavigateDiagnostics,
}: KPIStripProps) {
    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                <KPICard
                    icon={
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={AdminColors.primary}>
                            <Path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </Svg>
                    }
                    title={`Groups (${counts.groups})`}
                    subtitle="MANAGE"
                    onPress={onNavigateGroups}
                />
                <KPICard
                    icon={
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={AdminColors.primary}>
                            <Path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zM4 10h16v2H4z" />
                        </Svg>
                    }
                    title={`Payments (${counts.payments})`}
                    subtitle="HISTORY"
                    onPress={onNavigatePayments}
                />
                <KPICard
                    icon={
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={AdminColors.primary}>
                            <Path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                        </Svg>
                    }
                    title={`Auctions (${counts.auctions})`}
                    subtitle="BIDDING"
                    onPress={onNavigateAuctions}
                />
                <KPICard
                    icon={
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={AdminColors.primary}>
                            <Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                        </Svg>
                    }
                    title="Diagnostics"
                    subtitle="HEALTH"
                    onPress={onNavigateDiagnostics}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    kpiCard: {
        width: '47%',
        flexGrow: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: AdminColors.slate100,
        ...softElevation,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: AdminColors.cyan50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    kpiTitle: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 13,
        color: AdminColors.textPrimary,
        textAlign: 'center',
    },
    kpiSubtitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: AdminColors.slate400,
        letterSpacing: 1.5,
        marginTop: 4,
        textAlign: 'center',
    },
});