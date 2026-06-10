import { StyleSheet } from 'react-native';

// Shared color palette matching Stitch / admin design system
export const AdminColors = {
    primary: '#005E7D',
    primaryContainer: '#01789E',
    primaryLight: '#C1E8FF',
    secondary: '#006A65',
    accent: '#54FAEF',
    accentLight: '#10D7CD',
    textPrimary: '#0B1C30',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTertiary: '#F8F9FF',
    cyan50: '#ECFEFF',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate400: '#94A3B8',
    slate500: '#64748B',
    success: '#10B981',
    successBg: '#F0FDF4',
    successBorder: '#DCFCE7',
    successText: '#16A34A',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    warningBorder: '#FEF3C7',
    warningText: '#D97706',
    error: '#EF4444',
    errorBg: '#FEE2E2',
    errorBorder: '#FECACA',
    errorText: '#B91C1C',
};

// Shared card styles
export const AdminCardStyles = StyleSheet.create({
    card: {
        backgroundColor: AdminColors.bgPrimary,
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: AdminColors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardLabel: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: AdminColors.textTertiary,
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    cardValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 24,
        color: AdminColors.textPrimary,
    },
    cardValueMd: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 20,
        color: AdminColors.textPrimary,
    },
    cardTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 18,
        color: AdminColors.textPrimary,
        marginBottom: 12,
    },
    sectionTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 16,
        color: AdminColors.textPrimary,
        marginBottom: 14,
        marginTop: 4,
    },
});

// Badge styles
export const getBadgeStyle = (type: 'verified' | 'pending' | 'rejected' | 'active' | 'completed') => {
    switch (type) {
        case 'verified':
        case 'active':
            return {
                backgroundColor: AdminColors.successBg,
                borderColor: AdminColors.successBorder,
                color: AdminColors.successText,
            };
        case 'pending':
            return {
                backgroundColor: AdminColors.warningBg,
                borderColor: AdminColors.warningBorder,
                color: AdminColors.warningText,
            };
        case 'rejected':
            return {
                backgroundColor: AdminColors.errorBg,
                borderColor: AdminColors.errorBorder,
                color: AdminColors.errorText,
            };
        case 'completed':
            return {
                backgroundColor: '#E0F2FE',
                borderColor: '#BAE6FD',
                color: AdminColors.primary,
            };
        default:
            return {
                backgroundColor: AdminColors.bgSecondary,
                borderColor: AdminColors.border,
                color: AdminColors.textSecondary,
            };
    }
};

/** Stitch soft-elevation shadow */
export const softElevation = {
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 4,
};

export const AdminBadgeStyles = StyleSheet.create({
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 100,
        borderWidth: 1,
    },
    badgeText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        letterSpacing: 0.5,
    },
});
