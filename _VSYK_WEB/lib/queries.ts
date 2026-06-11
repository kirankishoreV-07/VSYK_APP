"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  ChitGroup,
  ChitMember,
  PaymentSchedule,
  Auction,
  ChitMemberTransaction,
  Nominee,
} from "@/lib/types";

// Ported from the mobile app's lib/hooks/useDashboard.ts and lib/* — same
// queries against the same Supabase backend.

export interface ActiveChit {
  membership_id: string;
  current_month: number | null;
  bid_status: string | null;
  chit_group: ChitGroup;
  next_payment: PaymentSchedule | null;
}

export interface DashboardStats {
  total_portfolio_value: number; // paise
  total_earnings: number; // paise
  active_chit_count: number;
}

export interface UpcomingAuction {
  id: string;
  scheduled_at: string;
  status: string;
  min_bid: number;
  chit_group: { name: string } | null;
}

export function useActiveChits(memberId: string | null) {
  return useQuery<ActiveChit[]>({
    queryKey: ["active-chits", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const { data: memberships, error } = await supabase
        .from("chit_members")
        .select(
          `id, current_month, bid_status,
           chit_group:chit_groups ( id, name, value, duration_months, monthly_installment, status, accounting_type )`
        )
        .eq("customer_id", memberId)
        .neq("bid_status", "completed")
        .neq("bid_status", "foreclosed");
      if (error) throw new Error(error.message);
      if (!memberships) return [];

      return Promise.all(
        memberships.map(async (m: any) => {
          const { data: payments } = await supabase
            .from("payment_schedules")
            .select("*")
            .eq("chit_member_id", m.id)
            .eq("paid", false)
            .order("due_date", { ascending: true })
            .limit(1);
          return {
            membership_id: m.id,
            current_month: m.current_month,
            bid_status: m.bid_status,
            chit_group: m.chit_group as ChitGroup,
            next_payment: payments?.[0] ?? null,
          };
        })
      );
    },
  });
}

export function useDashboardStats(memberId: string | null) {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId)
        return {
          total_portfolio_value: 0,
          total_earnings: 0,
          active_chit_count: 0,
        };

      const { count } = await supabase
        .from("chit_members")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", memberId)
        .neq("bid_status", "completed");

      const { data: memberships } = await supabase
        .from("chit_members")
        .select(`id, chit_group:chit_groups (value)`)
        .eq("customer_id", memberId);

      let portfolioValue = 0;
      let totalEarnings = 0;
      if (memberships) {
        for (const m of memberships as any[]) {
          if (m.chit_group) portfolioValue += Number(m.chit_group.value || 0);
          const { data: sumData } = await Promise.resolve(
            supabase.rpc("sum_dividends", { p_member_id: m.id })
          ).catch(() => ({ data: 0 }));
          totalEarnings += (sumData as number) || 0;
        }
      }

      return {
        total_portfolio_value: portfolioValue,
        total_earnings: totalEarnings,
        active_chit_count: count ?? 0,
      };
    },
  });
}

export function useUpcomingAuctions(memberId: string | null) {
  return useQuery<UpcomingAuction[]>({
    queryKey: ["upcoming-auctions", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const { data: memberGroups } = await supabase
        .from("chit_members")
        .select("chit_group_id")
        .eq("customer_id", memberId)
        .neq("bid_status", "completed");
      const groupIds = (memberGroups || []).map((g: any) => g.chit_group_id);
      if (groupIds.length === 0) return [];

      const now = new Date().toISOString();
      const { data: auctions, error } = await supabase
        .from("auctions")
        .select(
          `id, chit_group_id, scheduled_at, status, min_bid, chit_group:chit_groups ( name )`
        )
        .in("chit_group_id", groupIds)
        .eq("status", "upcoming")
        .gt("min_bid", 0)
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(20);
      if (error) throw new Error(error.message);
      if (!auctions) return [];

      const seen = new Set<string>();
      return (auctions as any[])
        .filter((a) => {
          if (seen.has(a.chit_group_id)) return false;
          seen.add(a.chit_group_id);
          return true;
        })
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          scheduled_at: a.scheduled_at,
          status: a.status,
          min_bid: Number(a.min_bid ?? 0),
          chit_group: a.chit_group,
        }));
    },
  });
}

export function useMemberChits(memberId: string | null) {
  return useQuery<ChitMember[]>({
    queryKey: ["member-chits", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const { data, error } = await supabase
        .from("chit_members")
        .select(
          `id, chit_group_id, customer_id, ticket_number, current_month, bid_status, joined_at,
           chit_groups ( id, name, value, duration_months, monthly_installment, status, accounting_type, group_code, start_date )`
        )
        .eq("customer_id", memberId)
        .order("joined_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as any) ?? [];
    },
  });
}

export interface ChitDetail {
  member: ChitMember;
  schedules: PaymentSchedule[];
  transactions: ChitMemberTransaction[];
  auctions: Auction[];
}

export function useChitDetail(membershipId: string | null) {
  return useQuery<ChitDetail | null>({
    queryKey: ["chit-detail", membershipId],
    enabled: !!membershipId,
    queryFn: async () => {
      if (!membershipId) return null;
      const { data: member, error } = await supabase
        .from("chit_members")
        .select(
          `id, chit_group_id, customer_id, ticket_number, current_month, bid_status, joined_at,
           chit_groups ( id, name, value, duration_months, monthly_installment, status, accounting_type, group_code, start_date, duration_months )`
        )
        .eq("id", membershipId)
        .single();
      if (error || !member) throw new Error(error?.message || "Not found");

      const groupId = (member as any).chit_group_id;
      const [schedules, transactions, auctions] = await Promise.all([
        supabase
          .from("payment_schedules")
          .select("*")
          .eq("chit_member_id", membershipId)
          .order("month_number", { ascending: true }),
        supabase
          .from("chit_member_transactions")
          .select("*")
          .eq("chit_member_id", membershipId)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("auctions")
          .select("*")
          .eq("chit_group_id", groupId)
          .order("auction_number", { ascending: true }),
      ]);

      return {
        member: member as any,
        schedules: (schedules.data as any) ?? [],
        transactions: (transactions.data as any) ?? [],
        auctions: (auctions.data as any) ?? [],
      };
    },
  });
}

export function useWalletTransactions(memberId: string | null) {
  return useQuery<ChitMemberTransaction[]>({
    queryKey: ["wallet-transactions", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const { data: members } = await supabase
        .from("chit_members")
        .select("id")
        .eq("customer_id", memberId);
      const memberIds = (members || []).map((m: any) => m.id);
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("chit_member_transactions")
        .select("*")
        .in("chit_member_id", memberIds)
        .order("transaction_date", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data as any) ?? [];
    },
  });
}

export function useMemberAuctions(memberId: string | null) {
  return useQuery<Auction[]>({
    queryKey: ["member-auctions", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const { data: memberGroups } = await supabase
        .from("chit_members")
        .select("chit_group_id")
        .eq("customer_id", memberId);
      const groupIds = Array.from(
        new Set((memberGroups || []).map((g: any) => g.chit_group_id))
      );
      if (groupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("auctions")
        .select(`*, chit_groups ( name )`)
        .in("chit_group_id", groupIds)
        .order("scheduled_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return (data as any) ?? [];
    },
  });
}

export function useNominees(memberId: string | null) {
  return useQuery<Nominee[]>({
    queryKey: ["nominees", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const { data, error } = await supabase
        .from("nominees")
        .select("*")
        .eq("user_id", memberId)
        .order("created_at", { ascending: true });
      if (error) return [];
      return (data as any) ?? [];
    },
  });
}
