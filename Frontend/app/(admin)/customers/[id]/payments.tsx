import React from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../../../lib/constants';
import { useCustomerDetailData } from '../../../../lib/hooks/admin/useCustomerDetailData';
import { PaymentsTab } from '../_components/PaymentsTab';
import { Text } from 'react-native';
import { useAdminParentBack } from '../../../../lib/hooks/admin/useAdminParentBack';

export default function PaymentsScreen() {
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
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
                            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.appBarTitle}>Payments</Text>
                </View>
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.appBar}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to customer details">
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
                            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.appBarTitle}>Payments</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error?.message || 'An error occurred'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const { customer, memberships, schedules, transactions } = data;

    return (
        <SafeAreaView style={styles.container}>
            {/* App Bar */}
            <View style={styles.appBar}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to customer details">
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
                        <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </Svg>
                </TouchableOpacity>
                <Text style={styles.appBarTitle}>
                    {customer?.full_name || 'Customer'} - Payments
                </Text>
            </View>

            {/* Payments Tab Content */}
            <PaymentsTab
                memberships={memberships}
                transactions={transactions}
                schedules={schedules}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    appBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    appBarTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
        color: '#0B1C30',
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
