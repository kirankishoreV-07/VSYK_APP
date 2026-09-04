import React from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useCustomerDetailData } from '../../../../lib/hooks/admin/useCustomerDetailData';
import { GroupsTab } from '../_components/GroupsTab';
import { AdminColors } from '../_components/adminStyles';
import { useAdminParentBack } from '../../../../lib/hooks/admin/useAdminParentBack';

export default function GroupsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const customerId = typeof id === 'string' ? id : '';
    const handleBack = useAdminParentBack(`/(admin)/customers/${customerId}` as any);

    const { data, isLoading, error } = useCustomerDetailData(customerId);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.appBar}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to customer details">
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={AdminColors.textPrimary}>
                            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                        </Svg>
                    </TouchableOpacity>
                </View>
                <ActivityIndicator size="large" color={AdminColors.primaryContainer} style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.appBar}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to customer details">
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={AdminColors.textPrimary}>
                            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                        </Svg>
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error?.message || 'An error occurred'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const { customer, memberships, schedules, transactions, auctions, participants, prizeSettlements } = data;
    const initials = (customer?.full_name || 'C')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.appBar}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to customer details">
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="#3F484E">
                        <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </Svg>
                </TouchableOpacity>
                <View style={styles.appBarCenter}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <Text style={styles.appBarTitle}>{customer?.full_name || 'Customer'}</Text>
                </View>
            </View>

            <View style={styles.body}>
                <GroupsTab
                    memberships={memberships}
                    schedules={schedules}
                    transactions={transactions}
                    auctions={auctions}
                    participants={participants}
                    prizeSettlements={prizeSettlements || []}
                    customerName={customer?.full_name || 'Customer'}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AdminColors.bgTertiary,
    },
    appBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226,232,240,0.5)',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
    },
    appBarCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: AdminColors.primaryContainer,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        color: '#E8F6FF',
    },
    appBarTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 20,
        color: AdminColors.primaryContainer,
        letterSpacing: -0.3,
    },
    body: {
        flex: 1,
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    errorText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: '#EF4444',
        textAlign: 'center',
    },
});
