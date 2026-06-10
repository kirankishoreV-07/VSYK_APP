// Utility functions for Admin Customer Detail Page

import { buildCsvDocument, paiseToCsvAmount } from '../../../../lib/csvExport';

/**
 * Convert paise (integer) to formatted rupee string
 * @param paise Amount in paise
 * @returns Formatted string like "₹1,23,456"
 */
export function formatPaise(paise: number): string {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Convert UTC timestamp to IST and format as short date
 * @param dateStr UTC timestamp string
 * @returns Formatted date like "15 Jan 2024"
 */
/** Display label for group selector chips (handles numeric-only names) */
export function getGroupChipLabel(
    name: string,
    ticketNumber: string | null,
    valuePaise: number,
): string {
    const trimmed = name.trim();
    const looksLikeAmount = /^[₹\d,\s.]+$/.test(trimmed);
    if (looksLikeAmount && ticketNumber) {
        return `Ticket #${ticketNumber}`;
    }
    if (looksLikeAmount) {
        return formatPaiseCompact(valuePaise);
    }
    if (trimmed.length > 22) {
        return `${trimmed.slice(0, 20)}…`;
    }
    return trimmed;
}

/** Short due label e.g. "15 Jul" */
export function formatDueShort(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Kolkata',
    });
}

/** Compact rupee format e.g. ₹2.8L, ₹95K */
export function formatPaiseCompact(paise: number): string {
    const rupees = paise / 100;
    if (rupees >= 100000) {
        const lakhs = rupees / 100000;
        const formatted = lakhs >= 10 ? Math.round(lakhs).toString() : lakhs.toFixed(1).replace(/\.0$/, '');
        return `₹${formatted}L`;
    }
    if (rupees >= 1000) {
        return `₹${Math.round(rupees / 1000)}K`;
    }
    return formatPaise(paise);
}

export function formatDateIST(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
}

/**
 * Convert UTC timestamp to IST and format as datetime
 * @param dateStr UTC timestamp string
 * @returns Formatted datetime like "15 Jan 2024, 14:30"
 */
export function formatDateTimeIST(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
    });
}

/**
 * Calculate days between two dates
 * @param startDate Earlier date
 * @param endDate Later date
 * @returns Number of days
 */
export function daysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a payment is overdue
 * @param dueDate Due date string
 * @param isPaid Whether the payment is completed
 * @returns True if overdue
 */
export function isOverdue(dueDate: string | null, isPaid: boolean): boolean {
    if (!dueDate || isPaid) return false;
    const due = new Date(dueDate);
    const now = new Date();
    return due.getTime() < now.getTime();
}

/**
 * Calculate on-time payment percentage
 * @param totalPayments Total number of payments
 * @param onTimePayments Number of on-time payments
 * @returns Percentage (0-100)
 */
export function calculateOnTimePercentage(totalPayments: number, onTimePayments: number): number {
    if (totalPayments === 0) return 0;
    return Math.round((onTimePayments / totalPayments) * 100);
}

/**
 * Derive risk level from payment metrics
 * @param overdueCount Number of overdue payments
 * @param onTimePercentage On-time payment percentage
 * @returns Risk level
 */
export function deriveRiskLevel(overdueCount: number, onTimePercentage: number): 'low' | 'medium' | 'high' {
    if (overdueCount >= 3 || onTimePercentage < 50) return 'high';
    if (overdueCount >= 1 || onTimePercentage < 80) return 'medium';
    return 'low';
}

/**
 * Get color for KYC status badge
 */
export function getKYCBadgeColor(status: string): { bg: string; text: string } {
    switch (status) {
        case 'verified':
            return { bg: '#DCFCE7', text: '#16A34A' };
        case 'pending':
            return { bg: '#FEF3C7', text: '#B45309' };
        case 'rejected':
            return { bg: '#FEE2E2', text: '#B91C1C' };
        default:
            return { bg: '#E2E8F0', text: '#475569' };
    }
}

/**
 * Get color for risk level badge
 */
export function getRiskBadgeColor(risk: string): { bg: string; text: string } {
    switch (risk) {
        case 'low':
            return { bg: '#DCFCE7', text: '#16A34A' };
        case 'medium':
            return { bg: '#FEF3C7', text: '#B45309' };
        case 'high':
            return { bg: '#FEE2E2', text: '#B91C1C' };
        default:
            return { bg: '#E2E8F0', text: '#475569' };
    }
}

/**
 * Get color for payment status badge
 */
export function getStatusBadgeColor(status: string): { bg: string; text: string } {
    switch (status) {
        case 'Full':
            return { bg: '#DCFCE7', text: '#16A34A' };
        case 'Partial':
            return { bg: '#FEF3C7', text: '#B45309' };
        case 'Unpaid':
            return { bg: '#E2E8F0', text: '#475569' };
        case 'Overdue':
            return { bg: '#FEE2E2', text: '#B91C1C' };
        case 'Won':
            return { bg: '#EDE9FE', text: '#7C3AED' };
        default:
            return { bg: '#E2E8F0', text: '#475569' };
    }
}

/**
 * Build admin payment history CSV (file-ready).
 */
export function exportToCSV(
    rows: Array<{
        cycle: number;
        dueDate: string | null;
        originalAmount: number;
        dividendApplied: number;
        netDue: number;
        paidOn: string | null;
        paidAmount: number;
        remaining?: number;
        method: string;
        status: string;
        refId: string | null;
        winner?: boolean;
    }>,
    customerName: string,
    groupName: string,
    options?: {
        ticketNumber?: string | null;
        accountingType?: string;
        exportedAt?: string;
    },
): string {
    const exportedAt = options?.exportedAt ?? new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const totalPaid = rows.reduce((sum, row) => sum + row.paidAmount, 0);
    const totalDue = rows.reduce((sum, row) => sum + row.netDue, 0);
    const totalRemaining = rows.reduce((sum, row) => sum + (row.remaining ?? Math.max(0, row.netDue - row.paidAmount)), 0);

    return buildCsvDocument(
        [
            ['Customer', customerName],
            ['Group', groupName],
            ['Ticket', options?.ticketNumber ?? '—'],
            ['Accounting Type', options?.accountingType ?? '—'],
            ['Exported At (IST)', exportedAt],
            ['Total Cycles', String(rows.length)],
            ['Total Due (INR)', paiseToCsvAmount(totalDue)],
            ['Total Paid (INR)', paiseToCsvAmount(totalPaid)],
            ['Total Remaining (INR)', paiseToCsvAmount(totalRemaining)],
        ],
        [
            'Cycle',
            'Due Date',
            'Payable Amount (INR)',
            'Dividend Applied (INR)',
            'Paid Amount (INR)',
            'Remaining (INR)',
            'Paid On',
            'Method',
            'Status',
            'Winner Cycle',
            'Reference ID',
        ],
        rows.map((row) => [
            row.cycle,
            row.dueDate ? formatDateIST(row.dueDate) : '',
            paiseToCsvAmount(row.netDue),
            paiseToCsvAmount(row.dividendApplied),
            paiseToCsvAmount(row.paidAmount),
            paiseToCsvAmount(row.remaining ?? Math.max(0, row.netDue - row.paidAmount)),
            row.paidOn ? formatDateIST(row.paidOn) : '',
            row.method || '',
            row.status,
            row.winner ? 'Yes' : 'No',
            row.refId || '',
        ]),
    );
}

/**
 * Generate CSV filename with timestamp
 */
export function generateCSVFilename(customerId: string, groupName: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedGroupName = groupName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return `customer-${customerId}-${sanitizedGroupName}-payments-${timestamp}.csv`;
}

/**
 * Parse month number from transaction notes
 * @param notes Transaction notes field
 * @returns Month number or null
 */
export function parseMonthFromNotes(notes: string | null): number | null {
    if (!notes) return null;
    const match = notes.match(/Month\s+(\d+)/i);
    return match ? Number(match[1]) : null;
}

/**
 * Check if two dates are in the same UTC month
 */
export function isSameUTCMonth(date1: Date, date2: Date): boolean {
    return date1.getUTCFullYear() === date2.getUTCFullYear() &&
        date1.getUTCMonth() === date2.getUTCMonth();
}

// Re-export shared chit payment helpers
export {
    type AuctionCycleInfo,
    dedupeAuctionCycles,
    getCycleDueAmount,
    getMemberDueAfterAuction,
    getUnaccountedCycleDueAmount,
    isCycleCollectible,
} from '../../../../lib/chitPayments';
