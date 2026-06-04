import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export interface AdminCustomerData {
  customer: any | null;
  memberships: any[];
  timeline: TimelineItem[];
  health: {
    totalOutstanding: number;
    overdueCount: number;
    nextDueDate: Date | null;
    lastActivityDate: Date | null;
  };
  loading: boolean;
  error: string | null;
}

export interface TimelineItem {
  id: string;
  monthString: string; // e.g. "YYYY-MM"
  monthDate: Date; // 1st of the month for sorting
  groupId: string;
  groupName: string;
  
  payableAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'Full' | 'Partial' | 'Unpaid' | 'Settled';
  isOverdue: boolean;
  
  isPostWin: boolean;
  participatedInAuction: boolean;
  
  dueDate: Date | null;
  transactions: any[];
}

export interface UnlinkedPayment {
  id: string;
  amount: number;
  date: Date;
  type: string;
  status: string;
  groupId?: string;
  groupName?: string;
}

export function useAdminCustomerDetail(customerId: string) {
  const [data, setData] = useState<AdminCustomerData>({
    customer: null,
    memberships: [],
    timeline: [],
    health: { totalOutstanding: 0, overdueCount: 0, nextDueDate: null, lastActivityDate: null },
    loading: true,
    error: null,
  });
  const [unlinkedPayments, setUnlinkedPayments] = useState<UnlinkedPayment[]>([]);

  const fetchAll = useCallback(async () => {
    if (!customerId) return;
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Q1: Customer profile
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
      if (custErr) throw custErr;

      // Q2: Memberships + group info
      const { data: memData, error: memErr } = await supabase
        .from('chit_members')
        .select(`
          *,
          chit_groups (*)
        `)
        .eq('customer_id', customerId);
      if (memErr) throw memErr;

      const memberIds = memData?.map(m => m.id) || [];
      const groupIds = memData?.map(m => m.chit_groups?.id).filter(Boolean) || [];

      if (memberIds.length === 0) {
        setData({
          customer: custData,
          memberships: [],
          timeline: [],
          health: { totalOutstanding: 0, overdueCount: 0, nextDueDate: null, lastActivityDate: null },
          loading: false,
          error: null
        });
        return;
      }

      // Parallel Queries
      const [
        { data: schedules, error: schedErr },
        { data: transactions, error: txErr },
        { data: auctions, error: aucErr },
        { data: participations, error: partErr }
      ] = await Promise.all([
        supabase.from('payment_schedules').select('*').in('chit_member_id', memberIds),
        supabase.from('chit_member_transactions').select('*').in('chit_member_id', memberIds),
        supabase.from('auctions').select('*').in('chit_group_id', groupIds),
        supabase.from('auction_participants').select('*').eq('customer_id', customerId) // by customer_id
      ]);

      if (schedErr) throw schedErr;
      if (txErr) throw txErr;
      if (aucErr) throw aucErr;
      if (partErr) throw partErr;

      // Processing Phase 3
      const currentMonthStart = new Date();
      currentMonthStart.setUTCHours(0, 0, 0, 0);
      currentMonthStart.setUTCDate(1);

      const timelineItems: TimelineItem[] = [];
      const unlinked: UnlinkedPayment[] = [];
      
      let totalOutstanding = 0;
      let overdueCount = 0;
      let nextDueDate: Date | null = null;
      let lastActivityDate: Date | null = null;

      // Map txns by schedule month to avoid double counting
      const txnsMapped = new Set<string>();

      // Group schedules by month & group
      for (const sched of (schedules || [])) {
        const member = memData?.find(m => m.id === sched.chit_member_id);
        if (!member) continue;
        const group = member.chit_groups;

        const schedDate = new Date(sched.due_date);
        const monthString = `${schedDate.getUTCFullYear()}-${String(schedDate.getUTCMonth() + 1).padStart(2, '0')}`;
        
        // Find auction for this group & month
        const auctionForMonth = auctions?.find(a => {
          if (a.chit_group_id !== group.id) return false;
          const aDate = new Date(a.auction_date);
          return aDate.getUTCFullYear() === schedDate.getUTCFullYear() && aDate.getUTCMonth() === schedDate.getUTCMonth();
        });

        // 1. Payable for month (priority)
        let payableAmount = group.monthly_installment;
        if (sched.amount !== null && sched.amount !== undefined) payableAmount = sched.amount;
        if (auctionForMonth?.installment_due !== null && auctionForMonth?.installment_due !== undefined) payableAmount = auctionForMonth.installment_due;
        if (auctionForMonth?.final_due_amount !== null && auctionForMonth?.final_due_amount !== undefined) payableAmount = auctionForMonth.final_due_amount;

        // Find relevant transactions
        // Matching by schedule month/year OR explicit auction_id matching
        const monthTxns = (transactions || []).filter(tx => {
          if (tx.chit_member_id !== member.id) return false;
          if (tx.status !== 'completed' && tx.status !== 'success') return false; // assuming success/completed
          if (tx.payment_type !== 'installment') return false;

          const tDate = new Date(tx.transaction_date);
          const tMonthStr = `${tDate.getUTCFullYear()}-${String(tDate.getUTCMonth() + 1).padStart(2, '0')}`;
          
          if (tMonthStr === monthString) {
            return true;
          }
          if (auctionForMonth && tx.auction_id === auctionForMonth.id) {
            return true;
          }
          return false;
        });

        let paidAmount = 0;
        for (const tx of monthTxns) {
          paidAmount += tx.amount || 0;
          txnsMapped.add(tx.id);
          const tDate = new Date(tx.transaction_date);
          if (!lastActivityDate || tDate > lastActivityDate) {
            lastActivityDate = tDate;
          }
        }

        // 2. Status per month
        let status: 'Full' | 'Partial' | 'Unpaid' | 'Settled' = 'Unpaid';
        if (payableAmount === 0 && (auctionForMonth?.final_due_amount === 0 || auctionForMonth?.final_due_amount === null)) {
            // Note: 0 remaining edge case
            status = 'Settled';
        } else if (paidAmount >= payableAmount) {
          status = 'Full';
        } else if (paidAmount > 0) {
          status = 'Partial';
        }

        let remainingAmount = Math.max(0, payableAmount - paidAmount);
        if (status === 'Settled') remainingAmount = 0;
        
        totalOutstanding += remainingAmount;

        // 3. Overdue detection
        let isOverdue = false;
        if (status !== 'Full' && status !== 'Settled') {
          if (schedDate < currentMonthStart) {
            isOverdue = true;
            overdueCount++;
          }
          if (!nextDueDate || schedDate < nextDueDate) {
            nextDueDate = schedDate;
          }
        }

        // 4. Post-win marker
        let isPostWin = false;
        // find if customer won this group in a previous or current month
        const groupAuctions = auctions?.filter(a => a.chit_group_id === group.id) || [];
        const winAuction = groupAuctions.find(a => memberIds.includes(a.winner_member_id));
        if (winAuction) {
          const winDate = new Date(winAuction.auction_date);
          if (schedDate >= winDate) {
            isPostWin = true;
          }
        }

        // 5. Participation marker
        let participatedInAuction = false;
        if (auctionForMonth) {
           participatedInAuction = !!participations?.find(p => p.auction_id === auctionForMonth.id);
        }

        timelineItems.push({
          id: `${group.id}-${monthString}`,
          monthString,
          monthDate: new Date(`${monthString}-01T00:00:00Z`),
          groupId: group.id,
          groupName: group.name,
          payableAmount,
          paidAmount,
          remainingAmount,
          status,
          isOverdue,
          isPostWin,
          participatedInAuction,
          dueDate: schedDate,
          transactions: monthTxns,
        });
      }

      // 6. Unlinked payments
      for (const tx of (transactions || [])) {
        if (!txnsMapped.has(tx.id) && tx.payment_type === 'installment' && (tx.status === 'completed' || tx.status === 'success')) {
           const member = memData?.find(m => m.id === tx.chit_member_id);
           unlinked.push({
             id: tx.id,
             amount: tx.amount,
             date: new Date(tx.transaction_date),
             type: tx.payment_type,
             status: tx.status,
             groupId: member?.chit_groups?.id,
             groupName: member?.chit_groups?.name,
           });
           
           const tDate = new Date(tx.transaction_date);
           if (!lastActivityDate || tDate > lastActivityDate) {
             lastActivityDate = tDate;
           }
        }
      }
      
      // Sort timeline items descending by monthDate
      timelineItems.sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime());
      unlinked.sort((a, b) => b.date.getTime() - a.date.getTime());

      setData({
        customer: custData,
        memberships: memData || [],
        timeline: timelineItems,
        health: {
          totalOutstanding,
          overdueCount,
          nextDueDate,
          lastActivityDate
        },
        loading: false,
        error: null
      });
      setUnlinkedPayments(unlinked);

    } catch (err: any) {
      console.error('useAdminCustomerDetail error:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [customerId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { ...data, unlinkedPayments, refresh: fetchAll };
}
