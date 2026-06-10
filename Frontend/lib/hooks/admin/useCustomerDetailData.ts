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
    KPIMetrics,
} from '../../../app/(admin)/customers/_components/types';

interface CustomerDetailData {
    customer: Customer | null;
    memberships: ChitMember[];
    schedules: PaymentSchedule[];
    transactions: Transaction[];
    auctions: Auction[];
    participants: AuctionParticipant[];
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
                    kpiMetrics: {
                        activeChits: 0,
                        lifetimePaid: 0,
                        dividendEarned: 0,
                        outstanding: 0,
                        onTimePercentage: 0,
                    },
                };
            }

            // Parallel fetch for schedules, transactions, auctions, participants
            const [schedulesRes, transactionsRes, auctionsRes, participantsRes] = await Promise.all([
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
            ]);

            if (schedulesRes.error) throw schedulesRes.error;
            if (transactionsRes.error) throw transactionsRes.error;
            if (auctionsRes.error) throw auctionsRes.error;
            if (participantsRes.error) throw participantsRes.error;

            const schedules = (schedulesRes.data || []) as PaymentSchedule[];
            const transactions = (transactionsRes.data || []) as Transaction[];
            const auctions = (auctionsRes.data || []) as Auction[];
            const participants = (participantsRes.data || []) as AuctionParticipant[];

            // Calculate KPI metrics
            const activeChits = (memberships || []).filter(
                (m) => m.bid_status === 'active' || m.bid_status === 'bidding'
            ).length;

            const lifetimePaid = transactions
                .filter((t) => t.status === 'completed' && t.payment_type === 'installment')
                .reduce((sum, t) => sum + t.amount, 0);

            const dividendEarned = schedules
                .filter((s) => s.paid)
                .reduce((sum, s) => sum + s.dividend_amount, 0);

            const outstanding = schedules
                .filter((s) => !s.paid)
                .reduce((sum, s) => {
                    const paid = transactions
                        .filter(
                            (t) =>
                                t.chit_member_id === s.chit_member_id &&
                                t.status === 'completed' &&
                                t.payment_type === 'installment'
                        )
                        .reduce((tSum, t) => tSum + t.amount, 0);
                    return sum + Math.max(0, s.amount - paid);
                }, 0);

            // Calculate on-time percentage
            const paidSchedules = schedules.filter((s) => s.paid);
            const onTimeCount = paidSchedules.filter((s) => {
                if (!s.paid_at || !s.due_date) return false;
                const paidDate = new Date(s.paid_at);
                const dueDate = new Date(s.due_date);
                return paidDate <= dueDate;
            }).length;

            const onTimePercentage =
                paidSchedules.length > 0 ? Math.round((onTimeCount / paidSchedules.length) * 100) : 0;

            return {
                customer: customer as Customer,
                memberships: (memberships || []) as ChitMember[],
                schedules,
                transactions,
                auctions,
                participants,
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

        channel
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chit_member_transactions',
                },
                () => {
                    // Invalidate the query to refetch data
                    queryClient.invalidateQueries({ queryKey: ['admin', 'customer-detail', customerId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [customerId, queryClient]);

    return query;
}
