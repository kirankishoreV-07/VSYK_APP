// Shared types for Admin Customer Detail Page

export type KYCStatus = 'verified' | 'pending' | 'rejected';
export type RiskLevel = 'low' | 'medium' | 'high';
export type GroupStatus = 'active' | 'completed' | 'cancelled' | 'foreclosed';
export type BidStatus = 'active' | 'bidding' | 'completed' | 'foreclosed';
export type PaymentStatus = 'Full' | 'Partial' | 'Unpaid';
export type TransactionStatus = 'completed' | 'success' | 'failed' | 'refunded' | 'pending';
export type PaymentType = 'installment' | 'penalty' | 'registration' | 'dividend' | 'prize' | 'adjustment' | 'refund';
export type AuctionStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';
export type AccountingType = 'accounted' | 'unaccounted';

export interface Customer {
    id: string;
    customer_id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    customer_type: 'Individual' | 'Company';
    kyc_status: KYCStatus;
    created_at: string;
}

export interface ChitGroup {
    id: string;
    name: string;
    value: number; // paise
    duration_months: number;
    monthly_installment: number; // paise
    status: GroupStatus;
    start_date: string | null;
    accounting_type: AccountingType;
}

export interface ChitMember {
    id: string;
    chit_group_id: string;
    customer_id: string;
    ticket_number: string | null;
    current_month: number;
    bid_status: BidStatus;
    joined_at: string;
    chit_groups: ChitGroup;
}

export interface PaymentSchedule {
    id: string;
    chit_member_id: string;
    month_number: number;
    due_date: string;
    amount: number; // paise
    paid: boolean;
    paid_at: string | null;
    dividend_amount: number; // paise
}

export interface Transaction {
    id: string;
    chit_member_id: string;
    auction_id: string | null;
    payment_schedule_id?: string | null;
    amount: number; // paise
    payment_type: PaymentType;
    payment_method?: string | null;
    external_payment_id?: string | null;
    status: TransactionStatus;
    transaction_date: string;
    notes: string | null;
}

export interface Auction {
    id: string;
    chit_group_id: string;
    auction_number: number | null;
    scheduled_at: string;
    status: AuctionStatus;
    winner_member_id: string | null;
    winner_name: string | null;
    installment_due: number | null; // paise
    dividend_amount: number | null; // paise
    discount_amount: number | null; // paise
    final_due_amount: number | null; // paise
    winner_prize_amount: number | null; // paise
    ended_at: string | null;
}

export interface AuctionParticipant {
    id: string;
    auction_id: string;
    customer_id: string;
    joined_at: string;
}

// Derived types for UI
export interface KPIMetrics {
    activeChits: number;
    lifetimePaid: number; // paise
    dividendEarned: number; // paise
    outstanding: number; // paise
    onTimePercentage: number; // 0-100
}

export interface PaymentRow {
    cycle: number;
    dueDate: string | null;
    originalAmount: number; // paise
    dividendApplied: number; // paise
    netDue: number; // paise
    paidOn: string | null;
    paidAmount: number; // paise
    method: string;
    status: PaymentStatus;
    refId: string | null;
    isOverdue: boolean;
    isLate: boolean;
    daysLate: number;
    isWonCycle: boolean;
    isPostWin: boolean;
    transactions: Transaction[];
}

export interface MonthStripItem {
    monthNumber: number;
    status: 'paid' | 'partial' | 'due' | 'overdue' | 'future' | 'won';
    dueDate: string | null;
}

export interface GroupSummary {
    groupId: string;
    groupName: string;
    status: GroupStatus;
    progress: string; // "X/Y months"
    ticketNumber: string | null;
    chitValue: number; // paise
    monthlyInstallment: number; // paise
    tenure: number;
    currentCycle: number;
    nextDueDate: string | null;
    nextDueAmount: number; // paise
    totalPaid: number; // paise
    totalDue: number; // paise
    outstanding: number; // paise
}

export interface AuctionHistoryItem {
    auctionId: string;
    groupName: string;
    cycle: number;
    date: string;
    outcome: 'won' | 'bid' | 'not_participated';
    winningBid: number | null; // paise
    discountApplied: number; // paise
    winnerName: string | null;
}

export interface DiagnosticIssue {
    id: string;
    severity: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    entityType: 'transaction' | 'schedule' | 'auction' | 'member';
    entityId: string;
    groupName?: string;
    monthNumber?: number;
}

// Outer tab types
export type OuterTab = 'overview' | 'groups' | 'payments' | 'auctions' | 'diagnostics' | 'activity';

// Inner tab types (for Groups tab)
export type InnerTab = 'summary' | 'payment-history' | 'auction-history' | 'documents' | 'ledger';

export interface LedgerEntry {
    date: string;
    description: string;
    debit: number; // paise
    credit: number; // paise
    balance: number; // paise
    type: 'installment' | 'dividend' | 'refund' | 'adjustment' | 'prize';
}

export interface CashCollection {
    id: string;
    chit_member_id: string;
    month_number: number;
    amount: number; // paise
    denomination_500: number;
    denomination_200: number;
    denomination_100: number;
    denomination_50: number;
    denomination_20: number;
    denomination_10: number;
    notes: string | null;
    recorded_by: string | null;
    recorded_at: string;
    updated_at: string;
}

export interface AuctionPrizeSettlement {
    id: string;
    auction_id: string;
    chit_member_id: string;
    amount: number; // paise (this partial payout)
    denomination_500: number;
    denomination_200: number;
    denomination_100: number;
    denomination_50: number;
    denomination_20: number;
    denomination_10: number;
    notes: string | null;
    recorded_by: string | null;
    recorded_at: string;
    updated_at: string;
}
