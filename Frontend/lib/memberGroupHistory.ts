/** Customer group payment history — accounted + unaccounted edge cases. */

import { supabase } from './supabase';
import {
  dedupeAuctionCycles,
  getCycleDueAmount,
  type AuctionCycleInfo,
} from './chitPayments';
import { isMemberAuctionWinner } from './auctionWinner';
import { buildCsvDocument, paiseToCsvAmount } from './csvExport';
import { formatPaise } from './hooks/useDashboard';

export const UNAUTHORED_THEME = {
  bg: '#F0F9FF',
  border: '#BAE6FD',
  accent: '#01789E',
  badgeBg: '#01789E',
};

export type MonthPaymentStatus = 'paid' | 'partial' | 'pending' | 'awaiting_auction' | 'upcoming';

export type MonthPaymentRecord = {
  monthNumber: number;
  dueAmount: number | null;
  paidAmount: number;
  status: MonthPaymentStatus;
  paidAt: string | null;
  sourceLabel: string;
  auctionStatus?: string | null;
  isMemberWinner?: boolean;
  winnerPrizeAmount?: number | null;
};

export type MemberGroupSummary = {
  membershipId: string;
  groupId: string;
  groupName: string;
  accountingType: 'accounted' | 'unaccounted';
  bidStatus: string;
  groupStatus: string;
  currentMonth: number;
  durationMonths: number;
  monthlyInstallment: number;
  totalValue: number;
  totalPaid: number;
  totalOutstanding: number;
  monthsPaid: number;
  progressPct: number;
  isCompleted: boolean;
  lastActivityAt: string | null;
};

export type GroupHistoryDetail = {
  summary: MemberGroupSummary;
  months: MonthPaymentRecord[];
  breakdown: {
    paidAmount: number;
    partialAmount: number;
    pendingAmount: number;
    awaitingAmount: number;
  };
};

type PaymentScheduleRow = {
  id: string;
  chit_member_id?: string;
  month_number: number;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  due_date: string;
};

type TransactionRow = {
  id: string;
  chit_member_id?: string;
  payment_schedule_id?: string | null;
  amount: number;
  auction_id: string | null;
  transaction_date: string;
  notes: string | null;
  payment_type: string;
};

type CashRow = {
  id: string;
  chit_member_id?: string;
  month_number: number;
  amount: number;
  recorded_at: string;
};

function resolveMonthFromTransaction(
  tx: TransactionRow,
  auctionsById: Map<string, AuctionCycleInfo>,
  schedulesById: Map<string, number>,
): number | null {
  if (tx.payment_schedule_id) {
    const scheduleMonth = schedulesById.get(tx.payment_schedule_id);
    if (scheduleMonth != null) return scheduleMonth;
  }
  if (tx.auction_id) {
    const auction = auctionsById.get(tx.auction_id);
    if (auction?.auction_number != null) return auction.auction_number;
  }
  if (tx.notes) {
    const match = tx.notes.match(/Month\s+(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function groupTransactionsByMonth(
  transactions: TransactionRow[],
  auctionsById: Map<string, AuctionCycleInfo>,
  schedulesById: Map<string, number>,
): Map<number, { amount: number; latestAt: string }> {
  const map = new Map<number, { amount: number; latestAt: string }>();
  for (const tx of transactions) {
    if (tx.payment_type !== 'installment') continue;
    const month = resolveMonthFromTransaction(tx, auctionsById, schedulesById);
    if (month == null) continue;
    const existing = map.get(month) || { amount: 0, latestAt: tx.transaction_date };
    existing.amount += Number(tx.amount || 0);
    if (new Date(tx.transaction_date) > new Date(existing.latestAt)) {
      existing.latestAt = tx.transaction_date;
    }
    map.set(month, existing);
  }
  return map;
}

function getMonthStatus(
  dueAmount: number | null,
  paidAmount: number,
  schedulePaid: boolean,
): MonthPaymentStatus {
  if (dueAmount == null) return 'awaiting_auction';
  if (paidAmount <= 0 && !schedulePaid) {
    return dueAmount > 0 ? 'pending' : 'upcoming';
  }
  if (schedulePaid || paidAmount >= dueAmount) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'pending';
}

function buildVirtualSchedules(
  membershipId: string,
  durationMonths: number,
  monthlyInstallment: number,
  startDate?: string | null,
): PaymentScheduleRow[] {
  const base = startDate ? new Date(startDate) : new Date();
  const rows: PaymentScheduleRow[] = [];
  for (let i = 1; i <= durationMonths; i += 1) {
    const due = new Date(base.getFullYear(), base.getMonth() + i, 0);
    rows.push({
      id: `virtual-${membershipId}-${i}`,
      month_number: i,
      amount: monthlyInstallment,
      paid: false,
      paid_at: null,
      due_date: due.toISOString().split('T')[0],
    });
  }
  return rows;
}

export async function fetchMemberGroupSummaries(memberId: string): Promise<MemberGroupSummary[]> {
  const { data: memberships, error } = await supabase
    .from('chit_members')
    .select(`
      id, current_month, bid_status,
      chit_group:chit_groups (
        id, name, value, duration_months, monthly_installment, status, accounting_type
      )
    `)
    .eq('customer_id', memberId);

  if (error) throw error;
  if (!memberships?.length) return [];

  const summaries = await Promise.all(
    memberships.map(async (m: any) => {
      const detail = await fetchGroupHistoryDetail(m.id, memberId);
      return detail.summary;
    }),
  );

  return summaries.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function fetchGroupHistoryDetail(
  membershipId: string,
  memberId: string,
): Promise<GroupHistoryDetail> {
  const { data: membership, error: memberError } = await supabase
    .from('chit_members')
    .select(`
      id, current_month, bid_status,
      chit_group:chit_groups (
        id, name, value, duration_months, monthly_installment, status, accounting_type, start_date
      )
    `)
    .eq('id', membershipId)
    .eq('customer_id', memberId)
    .maybeSingle();

  if (memberError || !membership) throw new Error('Group membership not found');

  const group = (membership as any).chit_group;
  const isUnaccounted = group.accounting_type === 'unaccounted';
  const durationMonths = group.duration_months || 0;

  const [
    { data: schedules },
    { data: transactions },
    { data: cashRows },
    { data: auctionRows },
  ] = await Promise.all([
    supabase
      .from('payment_schedules')
      .select('id, month_number, amount, paid, paid_at, due_date')
      .eq('chit_member_id', membershipId)
      .order('month_number'),
    supabase
      .from('chit_member_transactions')
      .select('id, amount, auction_id, payment_schedule_id, transaction_date, notes, payment_type')
      .eq('chit_member_id', membershipId)
      .eq('status', 'completed'),
    supabase
      .from('cash_collections')
      .select('id, month_number, amount, recorded_at')
      .eq('chit_member_id', membershipId),
    supabase
      .from('auctions')
      .select('id, auction_number, status, final_due_amount, installment_due, winner_member_id, winner_prize_amount')
      .eq('chit_group_id', group.id)
      .order('auction_number'),
  ]);

  const auctions = dedupeAuctionCycles((auctionRows || []) as AuctionCycleInfo[]);
  const auctionsById = new Map(auctions.filter((a) => a.id).map((a) => [a.id!, a]));
  const auctionByMonth = new Map(
    auctions
      .filter((a) => a.auction_number != null)
      .map((a) => [a.auction_number!, a]),
  );

  const txByMonth = groupTransactionsByMonth(
    (transactions || []) as TransactionRow[],
    auctionsById,
    new Map(((schedules || []) as PaymentScheduleRow[]).map((s) => [s.id, s.month_number])),
  );

  const cashByMonth = new Map<number, CashRow>();
  (cashRows || []).forEach((row: any) => {
    cashByMonth.set(row.month_number, row as CashRow);
  });

  let paymentSchedules = (schedules || []) as PaymentScheduleRow[];
  if (paymentSchedules.length === 0 && durationMonths > 0) {
    paymentSchedules = buildVirtualSchedules(
      membershipId,
      durationMonths,
      group.monthly_installment,
      group.start_date,
    );
  }

  const scheduleByMonth = new Map(paymentSchedules.map((s) => [s.month_number, s]));
  const months: MonthPaymentRecord[] = [];

  for (let month = 1; month <= durationMonths; month += 1) {
    const schedule = scheduleByMonth.get(month);
    const auction = auctionByMonth.get(month);
    const memberWonThisMonth = isMemberAuctionWinner(auction, membershipId);
    const dueAmount = getCycleDueAmount(month, group.monthly_installment, auctions);

    let paidAmount = 0;
    let paidAt: string | null = null;
    let sourceLabel = 'Not recorded';

    if (isUnaccounted) {
      const cash = cashByMonth.get(month);
      if (cash) {
        paidAmount = cash.amount;
        paidAt = cash.recorded_at;
        sourceLabel = 'Cash recorded by admin';
      }
    } else {
      const txMonth = txByMonth.get(month);
      if (txMonth) {
        paidAmount = txMonth.amount;
        paidAt = txMonth.latestAt;
        sourceLabel = 'Online / logged payment';
      }
      if (schedule?.paid) {
        paidAmount = Math.max(paidAmount, schedule.amount);
        paidAt = paidAt || schedule.paid_at;
        if (sourceLabel === 'Not recorded') sourceLabel = 'Payment schedule';
      }
    }

    const status = getMonthStatus(dueAmount, paidAmount, !!schedule?.paid && !isUnaccounted);

    months.push({
      monthNumber: month,
      dueAmount,
      paidAmount,
      status: dueAmount == null ? 'awaiting_auction' : status,
      paidAt,
      sourceLabel,
      auctionStatus: auction?.status ?? null,
      isMemberWinner: memberWonThisMonth,
      winnerPrizeAmount: memberWonThisMonth
        ? (auction as { winner_prize_amount?: number | null })?.winner_prize_amount ?? null
        : null,
    });
  }

  let totalPaid = 0;
  let totalOutstanding = 0;
  let monthsPaid = 0;
  const breakdown = {
    paidAmount: 0,
    partialAmount: 0,
    pendingAmount: 0,
    awaitingAmount: 0,
  };

  let lastActivityAt: string | null = null;

  for (const m of months) {
    totalPaid += m.paidAmount;
    if (m.status === 'paid') {
      monthsPaid += 1;
      breakdown.paidAmount += m.paidAmount;
    } else if (m.status === 'partial') {
      breakdown.partialAmount += m.paidAmount;
      if (m.dueAmount != null) {
        totalOutstanding += Math.max(0, m.dueAmount - m.paidAmount);
      }
    } else if (m.status === 'awaiting_auction') {
      breakdown.awaitingAmount += m.dueAmount ?? group.monthly_installment;
    } else if (m.status === 'pending') {
      breakdown.pendingAmount += m.dueAmount ?? group.monthly_installment;
      if (m.dueAmount != null) totalOutstanding += Math.max(0, m.dueAmount - m.paidAmount);
    }

    if (m.paidAt && (!lastActivityAt || new Date(m.paidAt) > new Date(lastActivityAt))) {
      lastActivityAt = m.paidAt;
    }
  }

  const isCompleted =
    membership.bid_status === 'completed'
    || membership.bid_status === 'foreclosed'
    || group.status === 'completed'
    || monthsPaid >= durationMonths;

  const summary: MemberGroupSummary = {
    membershipId,
    groupId: group.id,
    groupName: group.name,
    accountingType: group.accounting_type,
    bidStatus: membership.bid_status,
    groupStatus: group.status,
    currentMonth: membership.current_month,
    durationMonths,
    monthlyInstallment: group.monthly_installment,
    totalValue: group.value,
    totalPaid,
    totalOutstanding,
    monthsPaid,
    progressPct: durationMonths > 0 ? Math.round((monthsPaid / durationMonths) * 100) : 0,
    isCompleted,
    lastActivityAt,
  };

  return { summary, months, breakdown };
}

export function buildGroupHistoryExport(detail: GroupHistoryDetail): string {
  const { summary, months } = detail;
  const exportedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return buildCsvDocument(
    [
      ['Group', summary.groupName],
      ['Type', summary.accountingType === 'unaccounted' ? 'Cash Only (Unaccounted)' : 'Accounted'],
      ['Status', summary.isCompleted ? 'Completed' : 'Active'],
      ['Progress', `${summary.monthsPaid}/${summary.durationMonths} months (${summary.progressPct}%)`],
      ['Total Paid (INR)', paiseToCsvAmount(summary.totalPaid)],
      ['Outstanding (INR)', paiseToCsvAmount(summary.totalOutstanding)],
      ['Exported At (IST)', exportedAt],
    ],
    [
      'Month',
      'Due Amount (INR)',
      'Paid Amount (INR)',
      'Remaining (INR)',
      'Status',
      'Source',
      'Paid Date',
      'Winner Cycle',
      'Prize Amount (INR)',
    ],
    months.map((m) => {
      const remaining =
        m.dueAmount != null ? Math.max(0, m.dueAmount - m.paidAmount) : null;
      return [
        m.monthNumber,
        m.dueAmount != null ? paiseToCsvAmount(m.dueAmount) : '',
        paiseToCsvAmount(m.paidAmount),
        remaining != null ? paiseToCsvAmount(remaining) : '',
        getStatusLabel(m.status),
        m.sourceLabel,
        m.paidAt ? new Date(m.paidAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        m.isMemberWinner ? 'Yes' : 'No',
        m.winnerPrizeAmount != null ? paiseToCsvAmount(m.winnerPrizeAmount) : '',
      ];
    }),
  );
}

export function buildGroupHistoryFilename(groupName: string): string {
  const stamp = new Date().toISOString().split('T')[0];
  const safeGroup = groupName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return `vsyk-${safeGroup || 'group'}-payment-history-${stamp}.csv`;
}

export function getStatusLabel(status: MonthPaymentStatus): string {
  switch (status) {
    case 'paid': return 'Paid';
    case 'partial': return 'Partial';
    case 'pending': return 'Pending';
    case 'awaiting_auction': return 'Awaiting Auction';
    case 'upcoming': return 'Upcoming';
    default: return status;
  }
}

export function getStatusColor(status: MonthPaymentStatus): string {
  switch (status) {
    case 'paid': return '#10B981';
    case 'partial': return '#F59E0B';
    case 'pending': return '#EF4444';
    case 'awaiting_auction': return '#64748B';
    default: return '#94A3B8';
  }
}

export type UpcomingDueItem = {
  id: string;
  membershipId: string;
  groupName: string;
  ticketNumber?: string | null;
  monthNumber: number;
  dueDate: string;
  /** Amount still owed (remaining for partial, full due for unpaid). */
  amountDue: number;
  fullDueAmount: number;
  paidAmount: number;
  status: 'partial' | 'pending' | 'overdue';
};

type BuildMonthsInput = {
  membershipId: string;
  durationMonths: number;
  monthlyInstallment: number;
  accountingType: 'accounted' | 'unaccounted';
  startDate?: string | null;
  schedules: PaymentScheduleRow[];
  cashRows: CashRow[];
  transactions: TransactionRow[];
  auctions: AuctionCycleInfo[];
};

/** Synchronous month ledger — same rules as fetchGroupHistoryDetail. */
export function buildMemberPaymentMonths(input: BuildMonthsInput): MonthPaymentRecord[] {
  const {
    membershipId,
    durationMonths,
    monthlyInstallment,
    accountingType,
    startDate,
    schedules,
    cashRows,
    transactions,
    auctions,
  } = input;

  const isUnaccounted = accountingType === 'unaccounted';
  const dedupedAuctions = dedupeAuctionCycles(auctions);
  const auctionsById = new Map(
    dedupedAuctions.filter((a) => a.id).map((a) => [a.id!, a]),
  );
  const auctionByMonth = new Map(
    dedupedAuctions
      .filter((a) => a.auction_number != null)
      .map((a) => [a.auction_number!, a]),
  );

  const txByMonth = groupTransactionsByMonth(
    transactions,
    auctionsById,
    new Map(schedules.map((s) => [s.id, s.month_number])),
  );
  const cashByMonth = new Map<number, CashRow>();
  cashRows.forEach((row) => cashByMonth.set(row.month_number, row));

  let paymentSchedules = schedules;
  if (paymentSchedules.length === 0 && durationMonths > 0) {
    paymentSchedules = buildVirtualSchedules(
      membershipId,
      durationMonths,
      monthlyInstallment,
      startDate,
    );
  }

  const scheduleByMonth = new Map(paymentSchedules.map((s) => [s.month_number, s]));
  const months: MonthPaymentRecord[] = [];

  for (let month = 1; month <= durationMonths; month += 1) {
    const schedule = scheduleByMonth.get(month);
    const auction = auctionByMonth.get(month);
    const memberWonThisMonth = isMemberAuctionWinner(auction, membershipId);
    const dueAmount = getCycleDueAmount(month, monthlyInstallment, dedupedAuctions);

    let paidAmount = 0;
    let paidAt: string | null = null;
    let sourceLabel = 'Not recorded';

    if (isUnaccounted) {
      const cash = cashByMonth.get(month);
      if (cash) {
        paidAmount = cash.amount;
        paidAt = cash.recorded_at;
        sourceLabel = 'Cash recorded by admin';
      }
    } else {
      const txMonth = txByMonth.get(month);
      if (txMonth) {
        paidAmount = txMonth.amount;
        paidAt = txMonth.latestAt;
        sourceLabel = 'Online / logged payment';
      }
      if (schedule?.paid) {
        paidAmount = Math.max(paidAmount, schedule.amount);
        paidAt = paidAt || schedule.paid_at;
        if (sourceLabel === 'Not recorded') sourceLabel = 'Payment schedule';
      }
    }

    const status = getMonthStatus(dueAmount, paidAmount, !!schedule?.paid && !isUnaccounted);

    months.push({
      monthNumber: month,
      dueAmount,
      paidAmount,
      status: dueAmount == null ? 'awaiting_auction' : status,
      paidAt,
      sourceLabel,
      auctionStatus: auction?.status ?? null,
      isMemberWinner: memberWonThisMonth,
      winnerPrizeAmount: memberWonThisMonth
        ? (auction as { winner_prize_amount?: number | null })?.winner_prize_amount ?? null
        : null,
    });
  }

  return months;
}

export function computeCustomerUpcomingDues(params: {
  memberships: Array<{
    id: string;
    chit_group_id: string;
    ticket_number?: string | null;
    chit_groups: {
      name: string;
      duration_months: number;
      monthly_installment: number;
      accounting_type: 'accounted' | 'unaccounted';
      start_date?: string | null;
    };
    bid_status: string;
  }>;
  schedules: PaymentScheduleRow[];
  cashCollections: CashRow[];
  transactions: TransactionRow[];
  auctions: Array<AuctionCycleInfo & { chit_group_id?: string }>;
  limit?: number;
}): UpcomingDueItem[] {
  const now = new Date();
  const items: UpcomingDueItem[] = [];

  for (const membership of params.memberships) {
    if (membership.bid_status !== 'active' && membership.bid_status !== 'bidding') continue;

    const group = membership.chit_groups;
    const memberSchedules = params.schedules.filter((s) => s.chit_member_id === membership.id);
    const memberCash = params.cashCollections.filter((c) => c.chit_member_id === membership.id);
    const memberTx = params.transactions.filter((t) => t.chit_member_id === membership.id);
    const groupAuctions = params.auctions.filter((a) => a.chit_group_id === membership.chit_group_id);

    const months = buildMemberPaymentMonths({
      membershipId: membership.id,
      durationMonths: group.duration_months,
      monthlyInstallment: group.monthly_installment,
      accountingType: group.accounting_type,
      startDate: group.start_date,
      schedules: memberSchedules,
      cashRows: memberCash,
      transactions: memberTx,
      auctions: groupAuctions,
    });

    const scheduleByMonth = new Map(memberSchedules.map((s) => [s.month_number, s]));

    for (const m of months) {
      if (m.status === 'paid' || m.status === 'awaiting_auction') continue;
      if (m.dueAmount == null) continue;

      const schedule = scheduleByMonth.get(m.monthNumber);
      const dueDate =
        schedule?.due_date
        ?? buildVirtualSchedules(membership.id, 1, group.monthly_installment, group.start_date)
          .find((s) => s.month_number === m.monthNumber)?.due_date
        ?? new Date().toISOString().split('T')[0];

      const dueDateObj = new Date(dueDate);
      const isOverdue = dueDateObj < now && m.status !== 'partial';

      if (m.status === 'partial') {
        items.push({
          id: `${membership.id}-${m.monthNumber}`,
          membershipId: membership.id,
          groupName: group.name,
          ticketNumber: membership.ticket_number,
          monthNumber: m.monthNumber,
          dueDate,
          amountDue: Math.max(0, m.dueAmount - m.paidAmount),
          fullDueAmount: m.dueAmount,
          paidAmount: m.paidAmount,
          status: isOverdue ? 'overdue' : 'partial',
        });
      } else if (m.status === 'pending') {
        items.push({
          id: `${membership.id}-${m.monthNumber}`,
          membershipId: membership.id,
          groupName: group.name,
          ticketNumber: membership.ticket_number,
          monthNumber: m.monthNumber,
          dueDate,
          amountDue: m.dueAmount,
          fullDueAmount: m.dueAmount,
          paidAmount: 0,
          status: isOverdue ? 'overdue' : 'pending',
        });
      }
    }
  }

  const sorted = items.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );

  return params.limit != null ? sorted.slice(0, params.limit) : sorted;
}
