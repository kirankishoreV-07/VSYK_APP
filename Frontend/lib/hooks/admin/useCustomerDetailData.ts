import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../supabase';
import type {
    Customer,
    ChitMember,
    PaymentSchedule,
    Transaction,
    Auction,
    AuctionParticipant,
    CashCollection,
    KPIMetrics,
    AuctionPrizeSettlement,
} from '../../../app/(admin)/customers/_components/types';
import { buildMemberPaymentMonths } from '../../memberGroupHistory';
import { dedupeAuctionCycles } from '../../chitPayments';

interface CustomerDetailData {
    customer: Customer | null;
    memberships: ChitMember[];
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    auctions: Auction[];
    participants: AuctionParticipant[];
    cashCollections: CashCollection[];
    prizeSettlements: AuctionPrizeSettlement[];  // Actual prize payouts to this customer for won auctions (supports partials)
    kpiMetrics: KPIMetrics;
}

/**
 * Main hook for fetching all customer detail data
 * Loads eagerly on mount
 */
export function useCustomerDetailData(customerId: string) {
    const queryClient = useQueryClient();

    const query = useQuery<CustomerDetailData>({
        queryKey: ['admin', 'customer-detail', customerId],
        queryFn: async () => {
            // Fetch customer profile
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();

            if (customerError) throw customerError;

            // Fetch memberships with group info
            const { data: memberships, error: membershipsError } = await supabase
                .from('chit_members')
                .select(`
          *,
          chit_groups (*)
        `)
                .eq('customer_id', customerId);

            if (membershipsError) throw membershipsError;

            const memberIds = (memberships || []).map((m) => m.id);
            const groupIds = (memberships || []).map((m) => m.chit_group_id);

            if (memberIds.length === 0) {
                return {
                    customer: customer as Customer,
                    memberships: [],
                    schedules: [],
                    transactions: [],
                    auctions: [],
                    participants: [],
                    cashCollections: [],
                    prizeSettlements: [],
                    kpiMetrics: {
                        activeChits: 0,
                        lifetimePaid: 0,
                        dividendEarned: 0,
                        outstanding: 0,
                        onTimePercentage: 0,
                    },
                };
            }

            // Parallel fetch for schedules, transactions, auctions, participants, cash, and prize settlements (winner payouts)
            const [schedulesRes, transactionsRes, auctionsRes, participantsRes, cashRes, prizeRes] = await Promise.all([
                supabase
                    .from('payment_schedules')
                    .select('*')
                    .in('chit_member_id', memberIds)
                    .order('month_number', { ascending: true }),
                supabase
                    .from('chit_member_transactions')
                    .select('*')
                    .in('chit_member_id', memberIds)
                    .order('transaction_date', { ascending: false }),
                supabase.from('auctions').select('*').in('chit_group_id', groupIds),
                supabase.from('auction_participants').select('*').eq('customer_id', customerId),
                supabase
                    .from('cash_collections')
                    .select('*')
                    .in('chit_member_id', memberIds)
                    .order('month_number', { ascending: true }),
                supabase
                    .from('auction_prize_settlements')
                    .select('*')
                    .in('chit_member_id', memberIds)
                    .order('recorded_at', { ascending: false }),
            ]);

            if (schedulesRes.error) throw schedulesRes.error;
            if (transactionsRes.error) throw transactionsRes.error;
            if (auctionsRes.error) throw auctionsRes.error;
            if (participantsRes.error) throw participantsRes.error;
            if (cashRes.error) throw cashRes.error;
            if (prizeRes.error) throw prizeRes.error;

            const schedules = (schedulesRes.data || []) as PaymentSchedule[];
            const transactions = (transactionsRes.data || []) as Transaction[];
            const auctions = (auctionsRes.data || []) as Auction[];
            const participants = (participantsRes.data || []) as AuctionParticipant[];
            const cashCollections = (cashRes.data || []) as CashCollection[];
            const prizeSettlements = (prizeRes.data || []) as AuctionPrizeSettlement[];

            // Calculate KPI metrics
            const activeChits = (memberships || []).filter(
                (m) => m.bid_status === 'active' || m.bid_status === 'bidding'
            ).length;

            let lifetimePaid = 0;
            let outstanding = 0;
            let paidMonthCount = 0;
            let onTimeCount = 0;

            for (const membership of memberships || []) {
                const group = membership.chit_groups;
                const memberSchedules = schedules.filter((s) => s.chit_member_id === membership.id);
                const memberCash = cashCollections.filter((c) => c.chit_member_id === membership.id);
                const memberTx = transactions.filter((t) => t.chit_member_id === membership.id);
                const groupAuctions = dedupeAuctionCycles(
                    auctions.filter((a) => a.chit_group_id === membership.chit_group_id),
                );

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
                    lifetimePaid += m.paidAmount;

                    if (m.status === 'paid') {
                        paidMonthCount += 1;
                        const schedule = scheduleByMonth.get(m.monthNumber);
                        if (m.paidAt && schedule?.due_date) {
                            if (new Date(m.paidAt) <= new Date(schedule.due_date)) onTimeCount += 1;
                        }
                    } else if (m.status === 'partial' && m.dueAmount != null) {
                        outstanding += Math.max(0, m.dueAmount - m.paidAmount);
                    } else if (m.status === 'pending' && m.dueAmount != null) {
                        outstanding += Math.max(0, m.dueAmount - m.paidAmount);
                    }
                }
            }

            const dividendEarned = schedules
                .filter((s) => s.paid)
                .reduce((sum, s) => sum + s.dividend_amount, 0);

            const onTimePercentage =
                paidMonthCount > 0 ? Math.round((onTimeCount / paidMonthCount) * 100) : 0;

            return {
                customer: customer as Customer,
                memberships: (memberships || []) as ChitMember[],
                schedules,
                transactions,
                auctions,
                participants,
                cashCollections,
                prizeSettlements,
                kpiMetrics: {
                    activeChits,
                    lifetimePaid,
                    dividendEarned,
                    outstanding,
                    onTimePercentage,
                },
            };
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
        enabled: !!customerId,
    });

    // Subscribe to real-time updates on chit_member_transactions
    useEffect(() => {
        if (!customerId) return;

        // Create unique channel name to avoid conflicts
        const channelName = `customer-detail-${customerId}`;

        // Remove any existing channel with this name first
        const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase.channel(channelName);

        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'customer-detail', customerId] });
        };

        channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_member_transactions' }, invalidate)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_collections' }, invalidate)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedules' }, invalidate)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_prize_settlements' }, invalidate)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [customerId, queryClient]);

    return query;
}
