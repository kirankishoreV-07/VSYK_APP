import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { formatPaise, formatShortDate } from '../../../lib/hooks/useDashboard';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform, Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../../lib/constants';
import { useMemberSession } from '../../../lib/MemberSessionContext';
import { apiPostAuthed } from '../../../lib/api';
import { dedupeAuctionCycles, getCycleDueAmount } from '../../../lib/chitPayments';
import { isMemberAuctionWinner, WINNER_HIGHLIGHT } from '../../../lib/auctionWinner';
import type { AuctionPrizeSettlement } from '../../(admin)/customers/_components/types';
import { MemberPrizePayoutDetailsModal } from './MemberPrizePayoutDetailsModal';

type PaymentRow = {
  id: string;
  month_number: number;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  dividend_amount?: number;
};

type AuctionSettlement = {
  id: string;
  auction_number: number | null;
  installment_due: number | null;
  final_due_amount: number | null;
  scheduled_at: string | null;
  closes_at: string | null;
  status: string; // 'upcoming' | 'live' | 'completed'
  winner_member_id?: string | null;
  winner_prize_amount?: number | null;
};

type CashCollectionRow = {
  id: string;
  month_number: number;
  amount: number; // paise
  recorded_at: string;
};

type ChitDetailData = {
  id: string;
  current_month: number;
  bid_status: string;
  chit_group: {
    id: string;
    name: string;
    value: number;
    duration_months: number;
    monthly_installment: number;
    status: string;
    start_date?: string | null;
    accounting_type: 'accounted' | 'unaccounted';
  };
  payments: PaymentRow[];
};

/** Auto-generate and save payment schedule rows if they don't exist yet */
async function ensurePaymentSchedules(membershipId: string, group: ChitDetailData['chit_group']): Promise<PaymentRow[]> {
  const { data: existing } = await supabase.from('payment_schedules')
    .select('*').eq('chit_member_id', membershipId).order('month_number');

  if (existing && existing.length > 0) return existing as PaymentRow[];

  // Generate based on chit group start_date
  const base = group.start_date ? new Date(group.start_date) : new Date();
  base.setDate(1); // Always start from the 1st

  const rows: Omit<PaymentRow, 'id'>[] = [];
  for (let i = 0; i < group.duration_months; i++) {
    const dueDate = new Date(base);
    dueDate.setMonth(dueDate.getMonth() + i + 1);
    dueDate.setDate(0); // Last day of the month
    rows.push({
      month_number: i + 1,
      due_date: dueDate.toISOString().split('T')[0],
      amount: group.monthly_installment,
      paid: false,
      paid_at: null,
      dividend_amount: 0,
    } as any);
  }

  const toInsert = rows.map(r => ({ ...r, chit_member_id: membershipId }));
  const { data: inserted, error } = await supabase.from('payment_schedules').insert(toInsert).select();
  if (error) {
    // Return virtual rows if insert fails (e.g., RLS)
    return rows.map((r, idx) => ({ ...r, id: `virtual-${idx}` } as PaymentRow));
  }
  return (inserted ?? []) as PaymentRow[];
}

function useChitDetail(membershipId: string, memberId: string | null) {
  return useQuery<ChitDetailData | null>({
    queryKey: ['chit-detail', membershipId, memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const { data: m } = await supabase.from('chit_members')
        .select('id, current_month, bid_status, chit_group:chit_groups(id,name,value,duration_months,monthly_installment,status,start_date,accounting_type)')
        .eq('id', membershipId)
        .eq('customer_id', memberId)
        .maybeSingle();
      if (!m) return null;
      const group = (m as any).chit_group;
      const payments = await ensurePaymentSchedules(membershipId, group);
      return { ...(m as any), payments };
    },
    enabled: !!membershipId && !!memberId,
  });
}

function useGroupAuctions(groupId?: string) {
  return useQuery<AuctionSettlement[]>({
    queryKey: ['chit-auctions', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('auctions')
        .select('id, auction_number, installment_due, final_due_amount, scheduled_at, closes_at, status, winner_member_id, winner_prize_amount')
        .eq('chit_group_id', groupId)
        .order('auction_number', { ascending: true });
      if (error) throw error;

      return dedupeAuctionCycles((data ?? []) as AuctionSettlement[]) as AuctionSettlement[];
    },
    enabled: !!groupId,
  });
}

// Hook to fetch partial payment totals per month
function usePartialPayments(membershipId: string | undefined, auctions: AuctionSettlement[]) {
  return useQuery<Record<number, number>>({
    queryKey: ['partial-payments', membershipId],
    queryFn: async () => {
      if (!membershipId) return {};

      const { data, error } = await supabase
        .from('chit_member_transactions')
        .select('amount, notes, auction_id')
        .eq('chit_member_id', membershipId)
        .eq('payment_type', 'installment')
        .eq('status', 'completed');

      if (error) throw error;

      const totals: Record<number, number> = {};

      // Group by month number
      (data || []).forEach((tx: any) => {
        // Extract month number from notes or auction mapping
        if (tx.auction_id) {
          const auction = auctions.find(a => a.id === tx.auction_id);
          if (auction?.auction_number) {
            totals[auction.auction_number] = (totals[auction.auction_number] || 0) + tx.amount;
          }
        } else if (tx.notes) {
          // Parse from notes: "Month X - ..."
          const match = tx.notes.match(/Month (\d+)/);
          if (match) {
            const monthNum = parseInt(match[1]);
            totals[monthNum] = (totals[monthNum] || 0) + tx.amount;
          }
        }
      });

      return totals;
    },
    enabled: !!membershipId,
  });
}

function useCashCollections(membershipId: string | undefined, isUnaccounted: boolean) {
  return useQuery<Record<number, CashCollectionRow>>({
    queryKey: ['cash-collections', membershipId],
    queryFn: async () => {
      if (!membershipId) return {};
      const { data, error } = await supabase
        .from('cash_collections')
        .select('id, month_number, amount, recorded_at')
        .eq('chit_member_id', membershipId);
      if (error) throw error;
      const byMonth: Record<number, CashCollectionRow> = {};
      (data ?? []).forEach((row: any) => {
        byMonth[row.month_number] = row as CashCollectionRow;
      });
      return byMonth;
    },
    enabled: !!membershipId && isUnaccounted,
  });
}

const addMonthsKeepDay = (date: Date, months: number) => {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const day = date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  return new Date(year, month, targetDay);
};

/** Calculate the display period based on month_number and group start_date */
function getMonthPeriod(payment: PaymentRow, groupStartDate?: string | null): { from: string; to: string; monthName: string; endDate: Date } {
  // Use group start_date + month offset for accurate per-month dates
  // Fallback to payment.due_date if no group start_date available
  let startDate: Date;
  if (groupStartDate) {
    const base = new Date(groupStartDate);
    // Month 1 starts on group start_date, Month 2 = +1 month, etc.
    startDate = addMonthsKeepDay(base, payment.month_number - 1);
  } else {
    // Fallback: derive from due_date by going back one month
    const due = new Date(payment.due_date);
    startDate = addMonthsKeepDay(due, -1);
    startDate.setDate(1);
  }
  const endDate = addMonthsKeepDay(startDate, 1);
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const monthName = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return { from: fmt(startDate), to: fmt(endDate), monthName, endDate };
}

function MonthTimelineItem({
  p, isCurrentDue, onPay, paying, payableAmount, groupStartDate, auctionStatus, partialPaid, isUnaccountedGroup, cashCollection, isMemberWinner, winnerPrizeAmount, prizeSettlements = [], wonAuction, onShowPrizeDetails,
}: {
  p: PaymentRow;
  isCurrentDue: boolean;
  onPay: (p: PaymentRow, payableAmount: number) => void;
  paying: boolean;
  payableAmount: number | null;
  groupStartDate?: string | null;
  auctionStatus?: string | null;
  partialPaid?: number;
  isUnaccountedGroup?: boolean;
  cashCollection?: CashCollectionRow;
  isMemberWinner?: boolean;
  winnerPrizeAmount?: number | null;
  prizeSettlements?: any[];
  wonAuction?: any;
  onShowPrizeDetails?: (auction: any) => void;
}) {
  const period = getMonthPeriod(p, groupStartDate);
  const dueKnown = payableAmount != null;
  // For unaccounted groups, cash_collections is the source of truth (not payment_schedules.paid).
  const cashFull = dueKnown && isUnaccountedGroup && !!cashCollection && cashCollection.amount >= payableAmount;
  const cashPartial = dueKnown && isUnaccountedGroup && !!cashCollection && cashCollection.amount > 0 && cashCollection.amount < payableAmount;
  const isPaid = p.paid || cashFull;
  const today = Date.now();
  const daysLeft = Math.ceil((period.endDate.getTime() - today) / 86400000);
  const overdue = dueKnown && daysLeft < 0 && !isPaid;

  // Calculate if this is a partial payment scenario
  const cashPartialPaid = cashPartial ? (cashCollection?.amount ?? 0) : 0;
  const effectivePartialPaid = cashPartialPaid || (partialPaid || 0);
  const hasPartialPayment = dueKnown && !isPaid && effectivePartialPaid > 0;
  const remainingAmount = dueKnown
    ? (hasPartialPayment ? Math.max(0, payableAmount - effectivePartialPaid) : payableAmount)
    : 0;

  // Payable only after prior auction settlement defines the installment amount
  const auctionStarted = auctionStatus === 'live' || auctionStatus === 'completed';
  const canPay = dueKnown && (isCurrentDue || auctionStarted || overdue) && !isPaid;
  const isUpcoming = !isPaid && !canPay;
  const awaitingSettlement = !dueKnown && !isPaid;

  // Label shown in the action row when auction is live but not yet settled
  const auctionLiveLabel = auctionStatus === 'live' && !isPaid;

  return (
    <View style={ts.item}>
      {/* Dot */}
      <View style={ts.lineCol}>
        <View style={[
          ts.dot,
          isMemberWinner && ts.dotWinner,
          isPaid && !isMemberWinner && ts.dotPaid,
          canPay && !isMemberWinner && ts.dotCurrent,
          isUpcoming && !isMemberWinner && ts.dotUpcoming,
        ]}>
          {isPaid && <Svg width={10} height={10} viewBox="0 0 24 24" fill="#FFF"><Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></Svg>}
          {canPay && <View style={ts.dotInner} />}
        </View>
      </View>

      {/* Card */}
      <View style={[
        ts.card,
        isMemberWinner && ts.cardWinner,
        isPaid && !isMemberWinner && ts.cardPaid,
        canPay && !overdue && !auctionLiveLabel && !isMemberWinner && ts.cardCurrent,
        auctionLiveLabel && !isMemberWinner && ts.cardLive,
        overdue && !isMemberWinner && ts.cardOverdue,
        isUpcoming && !isMemberWinner && ts.cardUpcoming,
      ]}>
        {/* Month name + amount */}
        <View style={ts.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[ts.monthName, isUpcoming && { color: '#94A3B8' }, overdue && { color: '#B91C1C' }]}>
              {period.monthName}
            </Text>
            <Text style={[ts.monthNumber, isUpcoming && { color: '#CBD5E1' }]}>
              Month {p.month_number} · {period.from} – {period.to}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[
              ts.amount,
              isPaid && { color: Colors.secondary },
              canPay && { color: overdue ? '#EF4444' : Colors.primary, fontSize: 20 },
              auctionLiveLabel && { color: '#F59E0B', fontSize: 20 },
              isUpcoming && { color: '#94A3B8' },
              awaitingSettlement && { color: '#94A3B8', fontSize: 16 },
            ]}>
              {awaitingSettlement
                ? '—'
                : hasPartialPayment
                  ? formatPaise(remainingAmount)
                  : formatPaise(payableAmount!)}
            </Text>
            {hasPartialPayment && (
              <View style={ts.partialBadge}>
                <Text style={ts.partialText}>
                  {formatPaise(effectivePartialPaid)} paid · {formatPaise(remainingAmount)} remaining
                </Text>
              </View>
            )}
            {overdue && <View style={ts.overdueBadge}><Text style={ts.overdueText}>OVERDUE</Text></View>}
            {auctionLiveLabel && (
              <View style={ts.liveBadge}><Text style={ts.liveText}>AUCTION LIVE</Text></View>
            )}
            {isCurrentDue && !overdue && !auctionLiveLabel && daysLeft >= 0 && (
              <View style={ts.dueBadge}><Text style={ts.dueText}>DUE IN {daysLeft}D</Text></View>
            )}
            {isMemberWinner && (
              <View style={ts.winnerBadge}>
                <Text style={ts.winnerBadgeText}>WINNER</Text>
              </View>
            )}
          </View>
        </View>

        {isMemberWinner && winnerPrizeAmount != null && winnerPrizeAmount > 0 && (
          <View style={ts.prizeInfoContainer}>
            <Text style={ts.winnerPrizeText}>
              Prize: {formatPaise(winnerPrizeAmount)}
              {(prizeSettlements || []).length > 0 && (() => {
                const received = (prizeSettlements || []).reduce((s, p) => s + (p.amount || 0), 0);
                const pending = Math.max(0, winnerPrizeAmount - received);
                return pending > 0 
                  ? `  · Received ${formatPaise(received)} · Pending ${formatPaise(pending)}`
                  : `  · Fully settled`;
              })()}
            </Text>
            {(prizeSettlements || []).length > 0 && wonAuction && onShowPrizeDetails && (
              <TouchableOpacity
                onPress={() => onShowPrizeDetails(wonAuction)}
                style={ts.detailsButton}
                activeOpacity={0.7}
              >
                <Text style={ts.detailsButtonText}>Details →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Divider */}
        <View style={ts.innerDivider} />

        {/* Action */}
        {isPaid ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill={Colors.secondary}>
              <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </Svg>
            <Text style={ts.statusPaid}>
              {isUnaccountedGroup && cashCollection
                ? `Paid · Cash · ${formatShortDate(cashCollection.recorded_at)} · ${formatPaise(cashCollection.amount)}`
                : isUnaccountedGroup
                  ? 'Paid · Cash'
                  : 'Paid · Online'}
            </Text>
            {(p.dividend_amount ?? 0) > 0 && (
              <View style={ts.dividendBadge}>
                <Text style={ts.dividendText}>+{formatPaise(p.dividend_amount!)} dividend</Text>
              </View>
            )}
          </View>
        ) : isUnaccountedGroup && cashPartial && cashCollection ? (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="#F59E0B">
                <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </Svg>
              <Text style={[ts.statusPaid, { color: '#D97706' }]}>
                {`Partial · Cash · ${formatShortDate(cashCollection.recorded_at)} · ${formatPaise(cashCollection.amount)} paid`}
              </Text>
            </View>
            <View style={ts.remainingCashBadge}>
              <Text style={ts.remainingCashText}>
                {formatPaise(remainingAmount)} still to be paid · pay balance in cash to staff
              </Text>
            </View>
          </View>
        ) : awaitingSettlement ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
            </Svg>
            <Text style={ts.statusScheduled}>
              Payable after Auction #{p.month_number} settles
            </Text>
          </View>
        ) : isUnaccountedGroup ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill={Colors.primary}>
              <Path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
            </Svg>
            <Text style={ts.statusScheduled}>
              {hasPartialPayment
                ? `${formatPaise(remainingAmount)} due · pay cash to staff`
                : 'Cash payment · Staff will record'}
            </Text>
          </View>
        ) : canPay ? (
          <TouchableOpacity
            style={[
              ts.payBtn,
              auctionLiveLabel && ts.payBtnLive,
              overdue && ts.payBtnOverdue,
              paying && { opacity: 0.6 },
            ]}
            onPress={() => onPay(p, Math.max(0, hasPartialPayment ? remainingAmount : payableAmount))}
            disabled={paying}
            activeOpacity={0.85}
          >
            {paying ? <ActivityIndicator color="#FFF" size="small" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="#FFF">
                  <Path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                </Svg>
                <Text style={ts.payBtnText}>
                  {hasPartialPayment ? 'PAY REMAINING' : overdue ? 'PAY NOW - OVERDUE' : 'PAY NOW'}
                </Text>
                <View style={ts.payBtnAmtBadge}>
                  <Text style={ts.payBtnAmt}>{formatPaise(hasPartialPayment ? remainingAmount : payableAmount)}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
            </Svg>
            <Text style={ts.statusScheduled}>Scheduled · Not yet due</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ChitDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { memberId, memberProfile } = useMemberSession();
  const { data, isLoading } = useChitDetail(id ?? '', memberId);
  const { data: auctions = [] } = useGroupAuctions(data?.chit_group?.id);
  const { data: partialPaymentTotals = {} } = usePartialPayments(id, auctions);
  const isUnaccounted = data?.chit_group?.accounting_type === 'unaccounted';
  const { data: cashByMonth = {} } = useCashCollections(id, isUnaccounted);

  // Load prize settlements (the actual money paid out to this member as auction winner, supporting partials)
  // This powers the "Received X · Pending Y" / "Fully settled" text for the winning month.
  const [prizeSettlements, setPrizeSettlements] = useState<any[]>([]);

  // For member-side prize payout details modal (equivalent to admin "DETAILS" button)
  const [showPrizeDetailsModal, setShowPrizeDetailsModal] = useState(false);
  const [selectedPrizeAuctionForDetails, setSelectedPrizeAuctionForDetails] = useState<any>(null);

  const onShowPrizeDetails = (auction: any) => {
    setSelectedPrizeAuctionForDetails(auction);
    setShowPrizeDetailsModal(true);
  };
  useEffect(() => {
    const mid = data?.id;
    if (!mid) {
      setPrizeSettlements([]);
      return;
    }
    const load = async () => {
      const { data: ps, error } = await supabase
        .from('auction_prize_settlements')
        .select('*')
        .eq('chit_member_id', mid)
        .order('recorded_at', { ascending: false });
      if (!error) setPrizeSettlements(ps || []);
    };
    load();

    const ch = supabase
      .channel(`prize-settlements-${mid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'auction_prize_settlements',
        filter: `chit_member_id=eq.${mid}`,
      }, load)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [data?.id]);

  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId || !data?.chit_group?.id) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['chit-detail', id, memberId] });
      queryClient.invalidateQueries({ queryKey: ['chit-auctions', data.chit_group.id] });
    };

    const channel = supabase
      .channel('member-chit-detail-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedules' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members', filter: `id=eq.${id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.chit_group?.id, id, memberId, queryClient]);
  const [paySheetVisible, setPaySheetVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [selectedPayable, setSelectedPayable] = useState(0);
  const [payMode, setPayMode] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');

  // ── Real-time subscription ───────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['chit-detail', id, memberId] });
      queryClient.invalidateQueries({ queryKey: ['active-chits', memberId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', memberId] });
      queryClient.invalidateQueries({ queryKey: ['partial-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['cash-collections', id] });
    };
    const channel = supabase
      .channel(`chit-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members', filter: `id=eq.${id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedules', filter: `chit_member_id=eq.${id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_member_transactions', filter: `chit_member_id=eq.${id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_collections', filter: `chit_member_id=eq.${id}` }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, memberId, queryClient]);

  // ── Razorpay Payment ─────────────────────────────────────────
  const handlePayment = async (payment: PaymentRow, payableAmount: number, payAmount: number) => {
    if (!memberProfile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const amountInPaise = payAmount || payableAmount || payment.amount;
    const group = data?.chit_group;

    // Payment state is written ONLY by the backend after Razorpay verification
    // (see Backend/src/payments/payments.ts). The client just refreshes its
    // cached views once the server confirms the recorded payment.
    const refreshAfterPayment = () => {
      queryClient.invalidateQueries({ queryKey: ['chit-detail', id, memberId] });
      queryClient.invalidateQueries({ queryKey: ['active-chits', memberId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', memberId] });
      queryClient.invalidateQueries({ queryKey: ['partial-payments', id] });
    };
    setPayingId(payment.id);
    try {
      // Try native Razorpay first, only if the native module is actually linked
      let RazorpayCheckout: any = null;
      if (require('react-native').NativeModules.RNRazorpayCheckout) {
        try {
          RazorpayCheckout = require('react-native-razorpay').default;
        } catch (e) { console.log('Razorpay require failed:', e); }
      }

      if (RazorpayCheckout && RazorpayCheckout.open) {
        let orderId: string | undefined;
        let keyId = '';
        let orderAmount = 0;

        try {
          // Server derives the real remaining from paid_amount and binds the
          // order to this schedule + the authenticated customer. `amount` is a
          // requested partial; the server clamps it to the remaining balance.
          const order = await apiPostAuthed<{ id: string; keyId: string; amount: number }>('/api/payments/razorpay/order', {
            paymentScheduleId: payment.id,
            amount: amountInPaise,
          });
          orderId = order.id;
          keyId = order.keyId;
          orderAmount = Number(order.amount || 0);
          if (!orderId || !keyId || !Number.isSafeInteger(orderAmount) || orderAmount <= 0) {
            throw new Error('Payment server returned an invalid order.');
          }
        } catch (orderErr: any) {
          Alert.alert('Payment Error', orderErr?.message || 'Failed to create payment order.');
          setPayingId(null);
          return;
        }

        const options = {
          description: `VSYK Chits - ${group?.name ?? 'Chit'} - Month ${payment.month_number}`,
          currency: 'INR',
          key: keyId,
          order_id: orderId,
          amount: orderAmount,
          name: 'VSYK Chit Funds',
          prefill: {
            email: memberProfile.email ?? 'member@vsyk.in',
            contact: memberProfile.phone ?? '',
            name: memberProfile.full_name ?? '',
          },
          theme: { color: '#0B1C30' },
        };
        const paymentData = await RazorpayCheckout.open(options);
        if (paymentData?.razorpay_order_id && paymentData?.razorpay_payment_id && paymentData?.razorpay_signature) {
          // The backend verifies the signature, re-fetches the payment from
          // Razorpay, and records it. It is the ONLY writer of payment state.
          const verify = await apiPostAuthed<{
            verified: boolean; fullyPaid: boolean; partial: boolean; remaining: number; appliedAmount: number;
          }>('/api/payments/razorpay/verify', {
            orderId: paymentData.razorpay_order_id,
            paymentId: paymentData.razorpay_payment_id,
            signature: paymentData.razorpay_signature,
          });
          if (!verify.verified) {
            Alert.alert('Payment Verification Failed', 'Please try again.');
            setPayingId(null);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (verify.fullyPaid) {
            Alert.alert('Payment Successful', `Month ${payment.month_number} is now fully paid.`);
          } else {
            Alert.alert('Partial Payment Recorded', `Received ${formatPaise(verify.appliedAmount)}.\n\nRemaining: ${formatPaise(verify.remaining)}`);
          }
          refreshAfterPayment();
        }
      } else {
        // No native Razorpay (e.g. Expo Go): payments require a dev/prod build.
        // We intentionally do NOT simulate/mark payments — payment state can
        // only come from a verified Razorpay transaction.
        Alert.alert(
          'Payment Unavailable Here',
          'Online payment needs the full VSYK Chits app build. Please use a development or production build to pay.',
        );
        setPayingId(null);
        return;
      }
    } catch (e: any) {
      if (e?.code !== 'PAYMENT_CANCELLED') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Payment Failed', e?.description ?? e?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPayingId(null);
    }
  };

  const openPaySheet = (payment: PaymentRow, payableAmount: number) => {
    setSelectedPayment(payment);
    setSelectedPayable(payableAmount);

    // Check if there's already a partial payment for this month
    const existingPartialPaid = partialPaymentTotals[payment.month_number] || 0;
    const remainingDue = existingPartialPaid > 0 ? Math.max(0, payableAmount - existingPartialPaid) : payableAmount;

    // If there's partial payment, default to full (which is now the remaining amount)
    // Otherwise, let user choose
    setPayMode('full');
    setPartialAmount('');
    setPaySheetVisible(true);
  };

  const submitPay = async () => {
    if (!selectedPayment) return;
    const payableAmount = selectedPayable || selectedPayment.amount;
    let payAmount = payableAmount;

    if (payMode === 'partial') {
      const parsed = Number(partialAmount);
      if (!parsed || parsed <= 0) {
        Alert.alert('Invalid amount', 'Enter a valid partial amount.');
        return;
      }
      payAmount = Math.min(parsed * 100, payableAmount);
    }

    setPaySheetVisible(false);
    await handlePayment(selectedPayment, payableAmount, payAmount);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }
  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
          <Text style={s.appBarTitle}>Chit Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={{ textAlign: 'center', marginTop: 80, color: '#94A3B8', fontFamily: 'Inter_400Regular' }}>
          Chit group not found or access denied.
        </Text>
      </SafeAreaView>
    );
  }

  const group = data.chit_group;
  const payments: PaymentRow[] = data.payments;
  const currentMonth: number = data.current_month;

  const settlementByMonth = new Map<number, AuctionSettlement>();
  auctions.forEach(a => {
    if (a.auction_number) settlementByMonth.set(a.auction_number, a);
  });

  const getPayable = (p: PaymentRow) => {
    const defaultInstallment = group?.monthly_installment || 0;
    const auctionList = Array.from(settlementByMonth.values());
    return getCycleDueAmount(p.month_number, defaultInstallment, auctionList);
  };

  // First unpaid month — for unaccounted, a month is covered when cash paid >= payable amount.
  const isCovered = (p: PaymentRow) => {
    if (p.paid) return true;
    const payable = getPayable(p);
    if (payable == null) return false;
    if (isUnaccounted) {
      const cc = cashByMonth[p.month_number];
      if (cc && cc.amount >= payable) return true;
    }
    return false;
  };
  const firstUnpaid = payments.find(p => !isCovered(p));

  const totalPaid = payments.reduce((sum, p) => {
    if (isUnaccounted) {
      const cc = cashByMonth[p.month_number];
      return cc ? sum + cc.amount : sum;
    }
    return p.paid ? sum + p.amount : sum;
  }, 0);

  const totalDue = payments.reduce((sum, p) => {
    if (isCovered(p)) return sum;
    const payable = getPayable(p);
    if (payable == null) return sum;
    if (isUnaccounted) {
      const paidForMonth = cashByMonth[p.month_number]?.amount ?? 0;
      return sum + Math.max(0, payable - paidForMonth);
    }
    return sum + payable;
  }, 0);

  const paidCount = payments.filter(isCovered).length;

  // isCurrentDue: true only for the very first unpaid month (used for the overdue/due-date badge logic)
  const isCurrentDue = (p: PaymentRow) =>
    firstUnpaid?.id === p.id;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* App Bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.appBarTitle} numberOfLines={1}>{group.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero Stats */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>CHIT VALUE</Text>
              <Text style={s.heroValue}>{formatPaise(group.value)}</Text>
            </View>
            <View style={[s.statusPill, group.status === 'active' && { backgroundColor: '#DCFCE7' }]}>
              <Text style={[s.statusPillText, group.status === 'active' && { color: '#16A34A' }]}>
                {group.status?.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatLabel}>MONTHLY DUE</Text>
              <Text style={s.heroStatVal}>{formatPaise(group.monthly_installment)}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatLabel}>DURATION</Text>
              <Text style={s.heroStatVal}>{group.duration_months} Months</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatLabel}>PROGRESS</Text>
              <Text style={s.heroStatVal}>{paidCount}/{group.duration_months}</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${Math.min((paidCount / group.duration_months) * 100, 100)}%` as any }]} />
          </View>
        </View>

        {/* Summary Cards */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderLeftColor: Colors.secondary }]}>
            <Text style={s.summaryLabel}>TOTAL PAID</Text>
            <Text style={[s.summaryVal, { color: Colors.secondary }]}>{formatPaise(totalPaid)}</Text>
          </View>
          <View style={[s.summaryCard, { borderLeftColor: '#EF4444' }]}>
            <Text style={s.summaryLabel}>REMAINING</Text>
            <Text style={[s.summaryVal, { color: '#EF4444' }]}>{formatPaise(totalDue)}</Text>
          </View>
        </View>

        {/* Timeline Header */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Payment Timeline</Text>
          <Text style={s.sectionSub}>{payments.length} installments</Text>
        </View>

        {/* Timeline */}
        <View style={ts.container}>
          {payments.length === 0 ? (
            <Text style={{ color: '#94A3B8', textAlign: 'center', padding: 24, fontFamily: 'Inter_400Regular' }}>
              No payment schedule found.
            </Text>
          ) : (
            payments.map((p, idx) => {
              const auction = settlementByMonth.get(p.month_number);
              const partialPaid = partialPaymentTotals[p.month_number] || 0;
              const cashCollection = cashByMonth[p.month_number];
              const membershipId = data?.id ?? null;
              const memberWonThisMonth = isMemberAuctionWinner(auction, membershipId);
              return (
                <View key={p.id}>
                  <MonthTimelineItem
                    p={p}
                    isCurrentDue={isCurrentDue(p)}
                    onPay={openPaySheet}
                    paying={payingId === p.id}
                    payableAmount={getPayable(p)}
                    groupStartDate={group?.start_date ?? null}
                    auctionStatus={auction?.status ?? null}
                    partialPaid={partialPaid}
                    isUnaccountedGroup={isUnaccounted}
                    cashCollection={cashCollection}
                    isMemberWinner={memberWonThisMonth}
                    winnerPrizeAmount={memberWonThisMonth ? (auction?.winner_prize_amount ?? null) : null}
                    prizeSettlements={prizeSettlements}
                    wonAuction={memberWonThisMonth ? auction : undefined}
                    onShowPrizeDetails={memberWonThisMonth ? onShowPrizeDetails : undefined}
                  />
                  {idx < payments.length - 1 && <View style={ts.connector} />}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={paySheetVisible} transparent animationType="fade" onRequestClose={() => setPaySheetVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          style={s.payOverlay}
        >
          <ScrollView
            contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.paySheet}>
              <Text style={s.payTitle}>Pay Installment</Text>
              {(() => {
                const existingPartialPaid = selectedPayment ? (partialPaymentTotals[selectedPayment.month_number] || 0) : 0;
                const totalDueOriginal = selectedPayable || 0;
                const remainingDue = existingPartialPaid > 0 ? Math.max(0, totalDueOriginal - existingPartialPaid) : totalDueOriginal;

                return (
                  <>
                    <Text style={s.paySub}>
                      Month {selectedPayment?.month_number ?? '-'}
                      {existingPartialPaid > 0 ? (
                        <Text style={{ color: '#F59E0B' }}> · {formatPaise(existingPartialPaid)} already paid</Text>
                      ) : null}
                    </Text>
                    {existingPartialPaid > 0 && (
                      <View style={{ backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10, marginTop: 8 }}>
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#92400E' }}>
                          Original due: {formatPaise(totalDueOriginal)}
                        </Text>
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#92400E', marginTop: 2 }}>
                          Remaining: {formatPaise(remainingDue)}
                        </Text>
                      </View>
                    )}
                    {!existingPartialPaid && (
                      <Text style={[s.paySub, { marginTop: -8 }]}>
                        Due {formatPaise(totalDueOriginal)}
                      </Text>
                    )}
                  </>
                );
              })()}

              <View style={s.payModeRow}>
                <TouchableOpacity
                  style={[s.payModeBtn, payMode === 'full' && s.payModeBtnActive]}
                  onPress={() => setPayMode('full')}
                >
                  <Text style={s.payModeText}>Pay Full</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.payModeBtn, payMode === 'partial' && s.payModeBtnActive]}
                  onPress={() => setPayMode('partial')}
                >
                  <Text style={s.payModeText}>Pay Partial</Text>
                </TouchableOpacity>
              </View>

              {payMode === 'partial' && (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={s.payInput}
                    placeholder="Enter amount in ₹"
                    keyboardType="number-pad"
                    value={partialAmount}
                    onChangeText={setPartialAmount}
                  />
                  <Text style={s.payHint}>
                    Max {formatPaise(selectedPayment ? Math.max(0, selectedPayable - (partialPaymentTotals[selectedPayment.month_number] || 0)) : selectedPayable)}
                  </Text>
                </View>
              )}

              <View style={s.payActions}>
                <TouchableOpacity style={s.payCancelBtn} onPress={() => setPaySheetVisible(false)}>
                  <Text style={s.payCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.payConfirmBtn} onPress={submitPay}>
                  <Text style={s.payConfirmText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Member-side Prize Payout Details (opened via small "Details" button on winning month) */}
      <MemberPrizePayoutDetailsModal
        visible={showPrizeDetailsModal}
        onClose={() => {
          setShowPrizeDetailsModal(false);
          setSelectedPrizeAuctionForDetails(null);
        }}
        auction={selectedPrizeAuctionForDetails}
        prizeSettlements={prizeSettlements}
        group={group}
      />
    </SafeAreaView>
  );
}

// ── Timeline Styles ───────────────────────────────────────────
const ts = StyleSheet.create({
  container: { paddingHorizontal: 4 },
  item: { flexDirection: 'row', gap: 12 },
  lineCol: { width: 28, alignItems: 'center', paddingTop: 8 },
  connector: { width: 2, height: 14, backgroundColor: '#E2E8F0', marginLeft: 13 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  dotPaid: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  dotCurrent: { backgroundColor: '#FFF', borderColor: Colors.primary, borderWidth: 2.5 },
  dotUpcoming: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  dotWinner: { backgroundColor: WINNER_HIGHLIGHT.badgeBg, borderColor: WINNER_HIGHLIGHT.borderStrong, borderWidth: 2.5 },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  card: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 18,
    padding: 16, marginBottom: 0, borderWidth: 1, borderColor: '#F1F5F9',
    ...Shadows.subtle,
  },
  cardPaid: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  cardCurrent: { borderColor: Colors.primary, borderWidth: 1.5 },
  cardOverdue: { borderColor: '#FECACA', backgroundColor: '#FFF5F5', borderWidth: 1.5 },
  cardUpcoming: { backgroundColor: 'rgba(255,255,255,0.55)', borderStyle: 'dashed' },
  cardLive: { borderColor: '#F59E0B', borderWidth: 1.5, backgroundColor: '#FFFBEB' },
  cardWinner: {
    borderColor: WINNER_HIGHLIGHT.borderStrong,
    borderWidth: 2,
    backgroundColor: WINNER_HIGHLIGHT.bg,
  },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  monthName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },
  monthNumber: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6B7280', marginTop: 3 },
  amount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.primary, textAlign: 'right' },

  innerDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },

  statusPaid: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#16A34A' },
  statusScheduled: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8' },

  // Full-width pay button — hard to miss
  payBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  payBtnOverdue: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  payBtnLive: { backgroundColor: '#D97706', shadowColor: '#D97706' },
  payBtnDisabled: { backgroundColor: '#CBD5E1', shadowColor: '#CBD5E1' },
  payBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFF', letterSpacing: 1 },
  payBtnAmtBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  payBtnAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#FFF' },

  overdueBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  overdueText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#B91C1C', letterSpacing: 0.5 },
  liveBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  liveText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#D97706', letterSpacing: 0.5 },
  dueBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  dueText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#92400E', letterSpacing: 0.5 },
  dividendBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  dividendText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#1E40AF' },
  partialBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  partialText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#92400E' },
  winnerBadge: {
    backgroundColor: WINNER_HIGHLIGHT.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: WINNER_HIGHLIGHT.border,
  },
  winnerBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: WINNER_HIGHLIGHT.badgeText,
    letterSpacing: 0.6,
  },
  winnerPrizeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: WINNER_HIGHLIGHT.text,
    flex: 1,
  },
  prizeInfoContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  detailsButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  detailsButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#0369A1',
  },
  remainingCashBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' },
  remainingCashText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#92400E' },
});

// ── Screen Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.6)', ...Shadows.subtle,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30', flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },

  heroCard: {
    backgroundColor: Colors.primary, borderRadius: 24, padding: 20, gap: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  heroValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: '#FFF', letterSpacing: -1, marginTop: 4 },
  statusPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFF', letterSpacing: 1 },

  heroStats: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStat: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.8 },
  heroStatVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FFF' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.secondary, borderRadius: 100 },

  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F1F5F9', borderLeftWidth: 3, gap: 6, ...Shadows.subtle,
  },
  summaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  summaryVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, letterSpacing: -0.5 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  sectionSub: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8' },
  payOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  paySheet: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 16,
  },
  payTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },
  paySub: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  payModeRow: { flexDirection: 'row', gap: 12 },
  payModeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  payModeBtnActive: { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' },
  payModeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0B1C30' },
  payInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#0B1C30',
  },
  payHint: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8' },
  payActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  payCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  payConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  payCancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  payConfirmText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF', letterSpacing: 0.5 },
});
