import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { OuterTab } from './types';

interface OuterTabsProps {
    activeTab: OuterTab;
    onTabChange: (tab: OuterTab) => void;
    diagnosticCount?: number;
}

const TABS: Array<{ key: OuterTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'groups', label: 'Groups' },
    { key: 'payments', label: 'Payments' },
    { key: 'auctions', label: 'Auctions' },
    { key: 'diagnostics', label: 'Diagnostics' },
    { key: 'activity', label: 'Activity' },
];

export function OuterTabs({ activeTab, onTabChange, diagnosticCount }: OuterTabsProps) {
    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const showBadge = tab.key === 'diagnostics' && diagnosticCount && diagnosticCount > 0;

                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, isActive && styles.tabActive]}
                            onPress={() => onTabChange(tab.key)}
                        >
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                {tab.label}
                                {showBadge && ` (${diagnosticCount})`}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 4,
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#0EA5E9',
    },
    tabText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: '#64748B',
    },
    tabTextActive: {
        color: '#0EA5E9',
    },
});
