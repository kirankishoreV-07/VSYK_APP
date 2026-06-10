import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { KPIMetrics } from './types';
import { formatPaise } from './utils';

interface KPIStripProps {
    metrics: KPIMetrics;
}

export function KPIStrip({ metrics }: KPIStripProps) {
    return (
        <View style={styles.container}>
            <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>ACTIVE CHITS</Text>
                <Text style={styles.kpiValue}>{metrics.activeChits}</Text>
            </View>
            <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>LIFETIME PAID</Text>
                <Text style={[styles.kpiValue, { fontSize: 16 }]}>{formatPaise(metrics.lifetimePaid)}</Text>
            </View>
            <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>DIVIDEND EARNED</Text>
                <Text style={[styles.kpiValue, { fontSize: 16, color: '#10B981' }]}>
                    {formatPaise(metrics.dividendEarned)}
                </Text>
            </View>
            <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>OUTSTANDING</Text>
                <Text style={[styles.kpiValue, { fontSize: 16, color: '#EF4444' }]}>
                    {formatPaise(metrics.outstanding)}
                </Text>
            </View>
            <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>ON-TIME %</Text>
                <Text style={[styles.kpiValue, { color: metrics.onTimePercentage >= 80 ? '#10B981' : '#F59E0B' }]}>
                    {metrics.onTimePercentage.toFixed(1)}%
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        paddingVertical: 16,
        paddingHorizontal: 12,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    kpiCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    kpiLabel: {
        fontFamily: 'Inter_700Bold',
        fontSize: 9,
        color: '#64748B',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    kpiValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 20,
        color: '#0B1C30',
    },
});
