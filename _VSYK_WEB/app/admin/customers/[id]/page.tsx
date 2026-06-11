"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Layers,
  Wallet,
  TrendingUp,
  AlertCircle,
  Clock,
  Trophy,
  Phone,
  Mail,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { useAdminCustomerDetail } from "@/lib/admin-queries";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  Badge,
  Spinner,
  EmptyState,
  StatCard,
} from "@/components/app/ui";
import {
  formatPaise,
  formatPaiseCompact,
  formatDateIST,
  cn,
} from "@/lib/utils";

type Tab = "overview" | "groups" | "payments" | "auctions";

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;
  const { data, isLoading } = useAdminCustomerDetail(id);
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <EmptyState
        title="Customer not found"
        action={
          <Link
            href="/admin/customers"
            className="text-sm font-semibold text-brand-600"
          >
            Back to Customers
          </Link>
        }
      />
    );
  }

  const c = data.customer;
  const k = data.kpis;
  const kyc = (c.kyc_status || "pending").toLowerCase();
  const initials = (c.full_name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "groups", label: "Groups" },
    { key: "payments", label: "Payments" },
    { key: "auctions", label: "Auctions" },
  ];

  return (
    <>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>

      {/* Header */}
      <Card className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient text-lg font-bold text-white">
          {initials}
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">{c.full_name}</h1>
          <p className="text-sm text-ink-fade">
            {c.customer_id ? `${c.customer_id} · ` : ""}
            {c.customer_type || "Individual"} · Member since{" "}
            {formatDateIST(c.created_at)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-mute">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </span>
            {c.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {c.email}
              </span>
            )}
            {c.pan_number && (
              <span className="inline-flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" /> {c.pan_number}
              </span>
            )}
          </div>
        </div>
        <Badge tone={kyc === "verified" ? "success" : "warning"}>
          <ShieldCheck className="h-3 w-3" /> KYC {kyc}
        </Badge>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Active Chits"
          value={k.activeChits}
          icon={<Layers className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Lifetime Paid"
          value={formatPaiseCompact(k.lifetimePaid)}
          icon={<Wallet className="h-4 w-4" />}
          accent="emerald"
        />
        <StatCard
          label="Dividend"
          value={formatPaiseCompact(k.dividendEarned)}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="teal"
        />
        <StatCard
          label="Outstanding"
          value={formatPaiseCompact(k.outstanding)}
          icon={<AlertCircle className="h-4 w-4" />}
          accent="rose"
        />
        <StatCard
          label="On-Time"
          value={`${k.onTimePercentage}%`}
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      {/* Tabs */}
      <div className="mb-5 mt-8 flex gap-1 overflow-x-auto rounded-2xl bg-surface-mute p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all",
              tab === t.key
                ? "bg-white text-brand-700 shadow-soft"
                : "text-ink-fade hover:text-ink-mute"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "groups" && <GroupsTab data={data} />}
      {tab === "payments" && <PaymentsTab data={data} />}
      {tab === "auctions" && <AuctionsTab data={data} />}
    </>
  );
}

type Detail = NonNullable<ReturnType<typeof useAdminCustomerDetail>["data"]>;

function OverviewTab({ data }: { data: Detail }) {
  const upcoming = data.schedules
    .filter((s) => !s.paid && s.due_date)
    .sort((a, b) => +new Date(a.due_date!) - +new Date(b.due_date!))
    .slice(0, 5);
  const recentTx = data.transactions.slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Upcoming Dues</h3>
        {!upcoming.length ? (
          <EmptyState title="No upcoming dues" />
        ) : (
          <Card className="divide-y divide-outline-soft p-0">
            {upcoming.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-ink-mute">
                  Month {s.month_number} · {formatDateIST(s.due_date)}
                </span>
                <span className="text-sm font-semibold text-ink">
                  {formatPaise(s.amount)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Recent Transactions
        </h3>
        {!recentTx.length ? (
          <EmptyState title="No transactions" />
        ) : (
          <Card className="divide-y divide-outline-soft p-0">
            {recentTx.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize text-ink">
                    {t.payment_type}
                  </p>
                  <p className="text-xs text-ink-fade">
                    {formatDateIST(t.transaction_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatPaise(t.amount)}
                  </p>
                  <Badge
                    tone={
                      t.status === "failed"
                        ? "danger"
                        : t.status === "refunded"
                        ? "warning"
                        : "success"
                    }
                  >
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function GroupsTab({ data }: { data: Detail }) {
  if (!data.memberships.length) return <EmptyState title="No group memberships" />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.memberships.map((m) => {
        const g = m.chit_groups;
        return (
          <Card key={m.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink">{g?.name}</p>
                <p className="text-xs text-ink-fade">
                  Ticket {m.ticket_number || "—"} · Month {m.current_month ?? 0}
                </p>
              </div>
              <Badge
                tone={m.bid_status === "foreclosed" ? "danger" : "success"}
              >
                {m.bid_status || "active"}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-surface-mute py-2">
                <p className="text-[10px] uppercase text-ink-fade">Value</p>
                <p className="text-sm font-semibold text-ink">
                  {formatPaiseCompact(g?.value ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-surface-mute py-2">
                <p className="text-[10px] uppercase text-ink-fade">Monthly</p>
                <p className="text-sm font-semibold text-ink">
                  {formatPaiseCompact(g?.monthly_installment ?? 0)}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PaymentsTab({ data }: { data: Detail }) {
  if (!data.transactions.length) return <EmptyState title="No payments recorded" />;
  return (
    <Card className="divide-y divide-outline-soft p-0">
      {data.transactions.map((t) => (
        <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-sm font-medium capitalize text-ink">
              {t.payment_type}
            </p>
            <p className="text-xs text-ink-fade">
              {formatDateIST(t.transaction_date, true)}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-semibold",
                t.status === "failed"
                  ? "text-ink-fade line-through"
                  : "text-ink"
              )}
            >
              {formatPaise(t.amount)}
            </p>
            <Badge
              tone={
                t.status === "failed"
                  ? "danger"
                  : t.status === "refunded"
                  ? "warning"
                  : "success"
              }
            >
              {t.status}
            </Badge>
          </div>
        </div>
      ))}
    </Card>
  );
}

function AuctionsTab({ data }: { data: Detail }) {
  const completed = data.auctions
    .filter((a) => a.status === "completed")
    .sort((a, b) => (b.auction_number || 0) - (a.auction_number || 0));
  if (!completed.length) return <EmptyState title="No completed auctions" />;
  return (
    <Card className="divide-y divide-outline-soft p-0">
      {completed.map((a) => {
        const won = data.memberships.some(
          (m) => m.id === a.winner_member_id
        );
        return (
          <div key={a.id} className="flex items-center gap-4 px-4 py-3.5">
            <span
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl",
                won ? "bg-amber-50 text-amber-600" : "bg-surface-mute text-ink-fade"
              )}
            >
              <Trophy className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">
                Auction #{a.auction_number}
              </p>
              <p className="text-xs text-ink-fade">
                {formatDateIST(a.scheduled_at)} · Winner:{" "}
                {a.winner_name || "—"}
              </p>
            </div>
            {a.winner_prize_amount != null && (
              <span className="text-sm font-semibold text-ink">
                {formatPaiseCompact(a.winner_prize_amount)}
              </span>
            )}
            {won && <Badge tone="warning">Won</Badge>}
          </div>
        );
      })}
    </Card>
  );
}
