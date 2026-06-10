// Utility functions for Admin Customer Detail Page

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
 * Export payment history to CSV format
 * @param rows Payment rows data
 * @param customerName Customer name for filename
 * @param groupName Group name for filename
 * @returns CSV content string
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
        method: string;
        status: string;
        refId: string | null;
    }>,
    customerName: string,
    groupName: string
): string {
    const headers = [
        'Cycle',
        'Due Date',
        'Original Amount (₹)',
        'Dividend Applied (₹)',
        'Net Due (₹)',
        'Paid On',
        'Paid Amount (₹)',
        'Method',
        'Status',
        'Reference ID',
    ];

    const csvRows = [headers.join(',')];

    rows.forEach((row) => {
        const values = [
            row.cycle,
            row.dueDate ? formatDateIST(row.dueDate) : '-',
            (row.originalAmount / 100).toFixed(2),
            (row.dividendApplied / 100).toFixed(2),
            (row.netDue / 100).toFixed(2),
            row.paidOn ? formatDateIST(row.paidOn) : '-',
            (row.paidAmount / 100).toFixed(2),
            row.method || '-',
            row.status,
            row.refId || '-',
        ];
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
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
