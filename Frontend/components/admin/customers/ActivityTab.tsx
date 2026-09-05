import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ActivityTab() {
    return (
        <View style={styles.container}>
            <View style={styles.placeholderCard}>
                <Text style={styles.placeholderTitle}>Activity Log Coming Soon</Text>
                <Text style={styles.placeholderText}>
                    Will track KYC changes, nominee updates, login events, and admin actions once the
                    audit_events table is added.
                    {'\n\n'}
                    Do not infer activity from current state (e.g., do not display "KYC verified on [today]"
                    based on kyc_status).
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 16,
    },
    placeholderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    placeholderTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 8,
    },
    placeholderText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: '#64748B',
        lineHeight: 22,
    },
});
