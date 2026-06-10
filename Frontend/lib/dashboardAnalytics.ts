/** Dashboard chart + live activity data helpers. */

import { formatPaise } from './hooks/useDashboard';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const SLICE_COLORS = ['#005E7D', '#01789E', '#0E7490', '#10D7CD', '#006A65', '#0891B2'];
const ZERO_SLICE_COLOR = '#E2E8F0';
const GAP_DEGREES = 2;
const MIN_SLICE_DEGREES = 4;

export type CollectionMonth = {
  label: string;
  shortLabel: string;
  year: number;
  month: number;
  amount: number;
  installmentAmount: number;
  cashAmount: number;
  txnCount: number;
  installmentCount: number;
  cashCount: number;
};

export type PieSlice = CollectionMonth & {
  id: string;
  index: number;
  percent: number;
  startAngle: number;
  endAngle: number;
  color: string;
  path: string;
  momChangePct: number | null;
  fullLabel: string;
};

export type CollectionPieData = {
  slices: PieSlice[];
  summary: {
    total6M: number;
    avgMonthly: number;
    momChangePct: number | null;
    peakMonth: CollectionMonth | null;
    currentMonth: CollectionMonth;
    rangeLabel: string;
    totalTxnCount: number;
  };
  sourceTotal: {
    installment: number;
    cash: number;
    installmentPct: number;
    cashPct: number;
  };
};

/** @deprecated Use CollectionPieData */
export type CollectionChartData = CollectionPieData;

export type DashboardActivity = {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  category: string;
  created_at: string;
  paymentLabel: string;
  monthNumber?: number;
  source: 'transaction' | 'cash';
};

type DatedAmount = { date: string; amount: number };

function buildLast6Months(now = new Date()): CollectionMonth[] {
  const months: CollectionMonth[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = MONTH_NAMES[month];
    const shortLabel = year !== now.getFullYear() ? `${label} '${String(year).slice(-2)}` : label;
    months.push({
      label,
      shortLabel,
      year,
      month,
      amount: 0,
      installmentAmount: 0,
      cashAmount: 0,
      txnCount: 0,
      installmentCount: 0,
      cashCount: 0,
    });
  }
  return months;
}

function addInstallmentToMonth(months: CollectionMonth[], dateStr: string, amount: number) {
  const date = new Date(dateStr);
  const bucket = months.find((m) => m.month === date.getMonth() && m.year === date.getFullYear());
  if (!bucket) return;
  const value = Number(amount || 0);
  bucket.installmentAmount += value;
  bucket.amount += value;
  bucket.installmentCount += 1;
  bucket.txnCount += 1;
}

function addCashToMonth(months: CollectionMonth[], dateStr: string, amount: number) {
  const date = new Date(dateStr);
  const bucket = months.find((m) => m.month === date.getMonth() && m.year === date.getFullYear());
  if (!bucket) return;
  const value = Number(amount || 0);
  bucket.cashAmount += value;
  bucket.amount += value;
  bucket.cashCount += 1;
  bucket.txnCount += 1;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function describeDonutSlice(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  if (endAngle - startAngle >= 359.99) {
    endAngle = startAngle + 359.99;
  }
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = polar(cx, cy, outerR, startAngle);
  const outerEnd = polar(cx, cy, outerR, endAngle);
  const innerStart = polar(cx, cy, innerR, endAngle);
  const innerEnd = polar(cx, cy, innerR, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

function computeSliceAngles(months: CollectionMonth[]): { start: number; end: number; visualWeight: number }[] {
  const total = months.reduce((sum, m) => sum + m.amount, 0);
  const positiveCount = months.filter((m) => m.amount > 0).length;

  if (total <= 0) {
    const even = 360 / months.length;
    return months.map((_, i) => ({
      start: i * even,
      end: (i + 1) * even,
      visualWeight: 1,
    }));
  }

  const weights = months.map((m) => {
    if (m.amount > 0) return m.amount;
    return positiveCount > 0 ? 0 : 1;
  });

  const minWeightTotal = months.filter((m) => m.amount <= 0).length * MIN_SLICE_DEGREES;
  const available = 360 - months.length * GAP_DEGREES - minWeightTotal;
  const positiveWeight = weights.reduce((sum, w, i) => sum + (months[i].amount > 0 ? w : 0), 0);

  let cursor = 0;
  return months.map((m) => {
    const gap = GAP_DEGREES / 2;
    cursor += gap;
    const start = cursor;

    let sweep: number;
    if (m.amount > 0 && positiveWeight > 0) {
      sweep = (m.amount / positiveWeight) * available;
    } else if (m.amount <= 0 && positiveCount > 0) {
      sweep = MIN_SLICE_DEGREES;
    } else {
      sweep = available / months.length;
    }

    cursor += sweep;
    const end = cursor;
    cursor += gap;

    return { start, end, visualWeight: sweep };
  });
}

export function buildCollectionPieData(
  transactions: DatedAmount[],
  cashCollections: DatedAmount[],
  now = new Date(),
): CollectionPieData {
  const months = buildLast6Months(now);

  transactions.forEach((tx) => addInstallmentToMonth(months, tx.date, tx.amount));
  cashCollections.forEach((cc) => addCashToMonth(months, cc.date, cc.amount));

  const total6M = months.reduce((sum, m) => sum + m.amount, 0);
  const totalInstallment = months.reduce((sum, m) => sum + m.installmentAmount, 0);
  const totalCash = months.reduce((sum, m) => sum + m.cashAmount, 0);
  const totalTxnCount = months.reduce((sum, m) => sum + m.txnCount, 0);
  const angles = computeSliceAngles(months);

  const slices: PieSlice[] = months.map((m, index) => {
    const prev = months[index - 1];
    const momChangePct =
      prev && prev.amount > 0
        ? Math.round(((m.amount - prev.amount) / prev.amount) * 100)
        : m.amount > 0
          ? 100
          : null;

    const { start, end } = angles[index];
    const color = m.amount > 0 ? SLICE_COLORS[index % SLICE_COLORS.length] : ZERO_SLICE_COLOR;
    const fullLabel = new Date(m.year, m.month, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });

    return {
      ...m,
      id: `${m.year}-${m.month}`,
      index,
      percent: total6M > 0 ? Math.round((m.amount / total6M) * 100) : 0,
      startAngle: start,
      endAngle: end,
      color,
      path: describeDonutSlice(100, 100, 52, 82, start, end),
      momChangePct,
      fullLabel,
    };
  });

  const avgMonthly = Math.round(total6M / months.length);
  const currentMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const momChangePct =
    prevMonth.amount > 0
      ? Math.round(((currentMonth.amount - prevMonth.amount) / prevMonth.amount) * 100)
      : currentMonth.amount > 0
        ? 100
        : null;

  const peakMonth = months.reduce<CollectionMonth | null>(
    (peak, m) => (!peak || m.amount > peak.amount ? m : peak),
    null,
  );

  const first = months[0];
  const last = months[months.length - 1];

  return {
    slices,
    summary: {
      total6M,
      avgMonthly,
      momChangePct,
      peakMonth: peakMonth && peakMonth.amount > 0 ? peakMonth : null,
      currentMonth,
      rangeLabel: `${MONTH_NAMES[first.month]} – ${MONTH_NAMES[last.month]} ${last.year}`,
      totalTxnCount,
    },
    sourceTotal: {
      installment: totalInstallment,
      cash: totalCash,
      installmentPct: total6M > 0 ? Math.round((totalInstallment / total6M) * 100) : 0,
      cashPct: total6M > 0 ? Math.round((totalCash / total6M) * 100) : 0,
    },
  };
}

export const EMPTY_COLLECTION_PIE_DATA: CollectionPieData = buildCollectionPieData([], []);

/** @deprecated Use buildCollectionPieData */
export function buildCollectionChartData(
  transactions: DatedAmount[],
  cashCollections: DatedAmount[],
  _width = 400,
  _height = 160,
  now = new Date(),
): CollectionPieData {
  return buildCollectionPieData(transactions, cashCollections, now);
}

export function formatRelativeTime(dateStr: string, now = new Date()): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapTransactionActivity(tx: any): DashboardActivity | null {
  const member = tx.chit_members;
  const customerName = member?.customers?.full_name || 'Member';
  const groupName = member?.chit_groups?.name || 'Group';
  const paymentType = tx.payment_type || 'installment';

  let description = `Payment from ${customerName}`;
  let paymentLabel = 'Payment';
  let type: 'credit' | 'debit' = 'credit';

  if (paymentType === 'dividend') {
    description = `Dividend to ${customerName}`;
    paymentLabel = 'Dividend';
    type = 'debit';
  } else if (paymentType === 'installment') {
    description = `Installment from ${customerName}`;
    paymentLabel = 'Installment';
  } else if (paymentType === 'penalty') {
    description = `Penalty from ${customerName}`;
    paymentLabel = 'Penalty';
  } else if (paymentType === 'registration') {
    description = `Registration from ${customerName}`;
    paymentLabel = 'Registration';
  }

  if (!tx.transaction_date) return null;

  return {
    id: `tx-${tx.id}`,
    amount: Number(tx.amount || 0),
    type,
    description,
    category: groupName,
    created_at: tx.transaction_date,
    paymentLabel,
    source: 'transaction',
  };
}

function mapCashActivity(cc: any): DashboardActivity | null {
  const member = cc.chit_members;
  const customerName = member?.customers?.full_name || 'Member';
  const groupName = member?.chit_groups?.name || 'Group';
  const recordedAt = cc.recorded_at || cc.updated_at;
  if (!recordedAt) return null;

  return {
    id: `cash-${cc.id}`,
    amount: Number(cc.amount || 0),
    type: 'credit',
    description: `Cash from ${customerName}`,
    category: groupName,
    created_at: recordedAt,
    paymentLabel: 'Cash',
    monthNumber: cc.month_number,
    source: 'cash',
  };
}

export function mergeDashboardActivity(
  transactions: any[],
  cashCollections: any[],
): DashboardActivity[] {
  const merged: DashboardActivity[] = [];

  for (const tx of transactions) {
    const mapped = mapTransactionActivity(tx);
    if (mapped) merged.push(mapped);
  }
  for (const cc of cashCollections) {
    const mapped = mapCashActivity(cc);
    if (mapped) merged.push(mapped);
  }

  return merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function countTodayActivity(activities: DashboardActivity[], now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return activities.filter((a) => new Date(a.created_at) >= start).length;
}

export function sumCollectionAmounts(
  transactions: { amount: number; payment_type?: string; status?: string }[],
  cashCollections: { amount: number }[],
): number {
  const txTotal = transactions
    .filter((t) => t.payment_type === 'installment' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const cashTotal = cashCollections.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  return txTotal + cashTotal;
}

export function formatMomLabel(pct: number | null): string {
  if (pct == null) return '—';
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}