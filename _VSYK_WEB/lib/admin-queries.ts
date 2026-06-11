"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Customer,
  ChitGroup,
  ChitMember,
  PaymentSchedule,
  ChitMemberTransaction,
  Auction,
} from "@/lib/types";

// Ported from the mobile admin screens — same queries, same Supabase backend.

export interface AdminMetrics {
  totalAUM: number; // rupees
  members: number;
  collection: number; // paise
  auctions: number;
  dividends: number; // paise
}

export interface AdminActivity {
  id: string;
  kind: "transaction" | "cash";
  amount: number;
  label: string;
  customer: string;
  group: string;
  date: string;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const [{ data: groups }, { count: memberCount }, { data: deposits }, { data: cash }, { data: auctionRows }] =
        await Promise.all([
          supabase.from("chit_groups").select("value"),
          supabase.from("customers").select("*", { count: "exact", head: true }),
          supabase
            .from("chit_member_transactions")
            .select("amount, transaction_date, payment_type, status")
            .eq("status", "completed"),
          supabase.from("cash_collections").select("amount, recorded_at"),
          supabase
            .from("auctions")
            .select("id, status, scheduled_at"),
        ]);

      const aum = (groups || []).reduce(
        (acc: number, g: any) => acc + Number(g.value || 0),
        0
      ) / 100;

      const installmentSum = (deposits || [])
        .filter((d: any) => d.payment_type === "installment")
        .reduce((a: number, d: any) => a + Number(d.amount || 0), 0);
      const cashSum = (cash || []).reduce(
        (a: number, c: any) => a + Number(c.amount || 0),
        0
      );
      const collection = installmentSum + cashSum;

      const auctionCount = (auctionRows || []).filter(
        (a: any) => a.status === "upcoming" || a.status === "live"
      ).length;

      const dividends = (deposits || [])
        .filter((d: any) => d.payment_type === "dividend")
        .reduce((a: number, d: any) => a + Number(d.amount || 0), 0);

      const metrics: AdminMetrics = {
        totalAUM: aum,
        members: memberCount || 0,
        collection,
        auctions: auctionCount,
        dividends,
      };

      // Recent activity
      const [{ data: txAct }, { data: cashAct }] = await Promise.all([
        supabase
          .from("chit_member_transactions")
          .select(
            `id, amount, payment_type, transaction_date, status,
             chit_members ( customers (full_name), chit_groups (name) )`
          )
          .eq("status", "completed")
          .order("transaction_date", { ascending: false })
          .limit(15),
        supabase
          .from("cash_collections")
          .select(
            `id, amount, month_number, recorded_at,
             chit_members ( customers (full_name), chit_groups (name) )`
          )
          .order("recorded_at", { ascending: false })
          .limit(15),
      ]);

      const activity: AdminActivity[] = [
        ...(txAct || []).map((t: any) => ({
          id: `tx-${t.id}`,
          kind: "transaction" as const,
          amount: Number(t.amount || 0),
          label: t.payment_type,
          customer: t.chit_members?.customers?.full_name || "Unknown",
          group: t.chit_members?.chit_groups?.name || "—",
          date: t.transaction_date,
        })),
        ...(cashAct || []).map((c: any) => ({
          id: `cash-${c.id}`,
          kind: "cash" as const,
          amount: Number(c.amount || 0),
          label: `cash · month ${c.month_number}`,
          customer: c.chit_members?.customers?.full_name || "Unknown",
          group: c.chit_members?.chit_groups?.name || "—",
          date: c.recorded_at,
        })),
      ]
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .slice(0, 20);

      return { metrics, activity };
    },
    staleTime: 60_000,
  });
}

export function useAdminCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as any) ?? [];
    },
    staleTime: 60_000,
  });
}

export interface AdminCustomerKpis {
  activeChits: number;
  lifetimePaid: number;
  dividendEarned: number;
  outstanding: number;
  onTimePercentage: number;
}

export interface AdminCustomerDetail {
  customer: Customer | null;
  memberships: (ChitMember & { chit_groups: ChitGroup })[];
  schedules: PaymentSchedule[];
  transactions: ChitMemberTransaction[];
  auctions: Auction[];
  kpis: AdminCustomerKpis;
}

export function useAdminCustomerDetail(customerId: string | null) {
  return useQuery<AdminCustomerDetail>({
    queryKey: ["admin", "customer-detail", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      const { data: memberships } = await supabase
        .from("chit_members")
        .select(`*, chit_groups (*)`)
        .eq("customer_id", customerId);

      const memberIds = (memberships || []).map((m: any) => m.id);
      const groupIds = (memberships || []).map((m: any) => m.chit_group_id);

      if (memberIds.length === 0) {
        return {
          customer: (customer as any) ?? null,
          memberships: [],
          schedules: [],
          transactions: [],
          auctions: [],
          kpis: {
            activeChits: 0,
            lifetimePaid: 0,
            dividendEarned: 0,
            outstanding: 0,
            onTimePercentage: 0,
          },
        };
      }

      const [schedulesRes, txRes, auctionsRes] = await Promise.all([
        supabase
          .from("payment_schedules")
          .select("*")
          .in("chit_member_id", memberIds)
          .order("month_number", { ascending: true }),
        supabase
          .from("chit_member_transactions")
          .select("*")
          .in("chit_member_id", memberIds)
          .order("transaction_date", { ascending: false }),
        supabase.from("auctions").select("*").in("chit_group_id", groupIds),
      ]);

      const schedules = (schedulesRes.data as any[]) || [];
      const transactions = (txRes.data as any[]) || [];
      const auctions = (auctionsRes.data as any[]) || [];

      const activeChits = (memberships || []).filter(
        (m: any) => m.bid_status === "active" || m.bid_status === "bidding"
      ).length;

      const lifetimePaid = transactions
        .filter((t) => t.status === "completed")
        .reduce((a, t) => a + Number(t.amount || 0), 0);
      const refunded = transactions
        .filter((t) => t.status === "refunded")
        .reduce((a, t) => a + Number(t.amount || 0), 0);

      const dividendEarned = schedules
        .filter((s) => s.paid)
        .reduce((a, s) => a + Number(s.dividend_amount || 0), 0);

      const outstanding = schedules
        .filter((s) => !s.paid)
        .reduce((a, s) => a + Number(s.amount || 0), 0);

      const paidSchedules = schedules.filter((s) => s.paid);
      const onTime = paidSchedules.filter(
        (s) => s.paid_at && s.due_date && new Date(s.paid_at) <= new Date(s.due_date)
      ).length;
      const onTimePercentage =
        paidSchedules.length > 0
          ? Math.round((onTime / paidSchedules.length) * 100)
          : 0;

      return {
        customer: (customer as any) ?? null,
        memberships: (memberships as any) || [],
        schedules,
        transactions,
        auctions,
        kpis: {
          activeChits,
          lifetimePaid: lifetimePaid - refunded,
          dividendEarned,
          outstanding,
          onTimePercentage,
        },
      };
    },
    staleTime: 120_000,
  });
}

export interface AdminGroup extends ChitGroup {
  chit_members?: { id: string }[];
}

export function useAdminGroups() {
  return useQuery<AdminGroup[]>({
    queryKey: ["admin", "groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chit_groups")
        .select("*, chit_members(id)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as any) ?? [];
    },
    staleTime: 60_000,
  });
}

export interface AdminGroupDetail {
  group: AdminGroup | null;
  members: (ChitMember & { customers: Customer | null })[];
  auctions: Auction[];
}

export function useAdminGroupDetail(groupId: string | null) {
  return useQuery<AdminGroupDetail>({
    queryKey: ["admin", "group-detail", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data: group } = await supabase
        .from("chit_groups")
        .select("*")
        .eq("id", groupId)
        .single();
      const [membersRes, auctionsRes] = await Promise.all([
        supabase
          .from("chit_members")
          .select(`*, customers (*)`)
          .eq("chit_group_id", groupId),
        supabase
          .from("auctions")
          .select("*")
          .eq("chit_group_id", groupId)
          .order("auction_number", { ascending: true }),
      ]);
      return {
        group: (group as any) ?? null,
        members: (membersRes.data as any) || [],
        auctions: (auctionsRes.data as any) || [],
      };
    },
    staleTime: 60_000,
  });
}

export function useAdminAuctions() {
  return useQuery<Auction[]>({
    queryKey: ["admin", "auctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(`*, chit_groups (name)`)
        .order("scheduled_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data as any) ?? [];
    },
    staleTime: 30_000,
  });
}
