"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Gavel,
  Trophy,
  Building2,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { useAdminGroupDetail } from "@/lib/admin-queries";
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

type Tab = "members" | "auctions" | "details";

export default function AdminGroupDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;
  const { data, isLoading } = useAdminGroupDetail(id);
  const [tab, setTab] = useState<Tab>("members");

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  if (!data?.group) {
    return (
      <EmptyState
        title="Group not found"
        action={
          <Link href="/admin/groups" className="text-sm font-semibold text-brand-600">
            Back to Groups
          </Link>
        }
      />
    );
  }

  const g = data.group;
  const isCash = g.accounting_type === "unaccounted";
  const completedAuctions = data.auctions.filter((a) => a.status === "completed").length;

  const tabs: { key: Tab; label: string }[] = [
    { key: "members", label: `Members (${data.members.length})` },
    { key: "auctions", label: `Auctions (${data.auctions.length})` },
    { key: "details", label: "Details" },
  ];

  return (
    <>
      <Link
        href="/admin/groups"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Groups
      </Link>

      <PageHeader
        title={g.name}
        subtitle={`${g.group_code ? g.group_code + " · " : ""}${
          g.duration_months
        } months · ${isCash ? "Cash group" : "Digital group"}`}
        action={
          <Badge tone={g.status === "active" ? "success" : "neutral"}>
            {g.status}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Chit Value"
          value={formatPaiseCompact(g.value)}
          icon={<Wallet className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Monthly"
          value={formatPaiseCompact(g.monthly_installment)}
          icon={<CalendarDays className="h-4 w-4" />}
          accent="teal"
        />
        <StatCard
          label="Members"
          value={`${data.members.length}/${g.capacity ?? "—"}`}
          icon={<Users className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Auctions Done"
          value={completedAuctions}
          icon={<Gavel className="h-4 w-4" />}
          accent="emerald"
        />
      </div>

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

      {tab === "members" &&
        (!data.members.length ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members" />
        ) : (
          <Card className="divide-y divide-outline-soft p-0">
            {data.members.map((m) => {
              const name = m.customers?.full_name || "Unknown";
              const initials = name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <Link
                  key={m.id}
                  href={
                    m.customer_id
                      ? `/admin/customers/${m.customer_id}`
                      : "/admin/groups"
                  }
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-mute"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {name}
                    </p>
                    <p className="text-xs text-ink-fade">
                      Ticket {m.ticket_number || "—"} · {m.customers?.phone}
                    </p>
                  </div>
                  <Badge
                    tone={m.bid_status === "foreclosed" ? "danger" : "success"}
                  >
                    {m.bid_status || "active"}
                  </Badge>
                </Link>
              );
            })}
          </Card>
        ))}

      {tab === "auctions" &&
        (!data.auctions.length ? (
          <EmptyState icon={<Gavel className="h-6 w-6" />} title="No auctions" />
        ) : (
          <Card className="divide-y divide-outline-soft p-0">
            {data.auctions.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-4 py-3.5">
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-xl",
                    a.status === "completed"
                      ? "bg-amber-50 text-amber-600"
                      : a.status === "live"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-surface-mute text-ink-fade"
                  )}
                >
                  {a.status === "completed" ? (
                    <Trophy className="h-5 w-5" />
                  ) : (
                    <Gavel className="h-5 w-5" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">
                    Auction #{a.auction_number}
                  </p>
                  <p className="text-xs text-ink-fade">
                    {formatDateIST(a.scheduled_at, true)}
                    {a.winner_name ? ` · ${a.winner_name}` : ""}
                  </p>
                </div>
                {a.winner_prize_amount != null && a.status === "completed" && (
                  <span className="text-sm font-semibold text-ink">
                    {formatPaiseCompact(a.winner_prize_amount)}
                  </span>
                )}
                <Badge
                  tone={
                    a.status === "completed"
                      ? "neutral"
                      : a.status === "live"
                      ? "danger"
                      : "info"
                  }
                >
                  {a.status}
                </Badge>
              </div>
            ))}
          </Card>
        ))}

      {tab === "details" && (
        <Card className="divide-y divide-outline-soft p-0">
          <DetailRow label="Group Code" value={g.group_code} />
          <DetailRow label="Foreman" value={g.foreman_name} />
          <DetailRow label="Agent in charge" value={g.agent_in_charge} />
          <DetailRow label="Bank" value={g.bank_name} />
          <DetailRow
            label="Interest Rate"
            value={g.interest_rate != null ? `${g.interest_rate}%` : null}
          />
          <DetailRow
            label="Monthly Installment"
            value={formatPaise(g.monthly_installment)}
          />
          <DetailRow label="Start Date" value={formatDateIST(g.start_date)} />
          <DetailRow label="End Date" value={formatDateIST(g.end_date)} />
          <DetailRow
            label="Accounting"
            value={isCash ? "Unaccounted (cash)" : "Accounted (digital)"}
          />
        </Card>
      )}
    </>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-ink-fade">{label}</span>
      <span className="text-right text-sm font-medium text-ink">
        {value || "—"}
      </span>
    </div>
  );
}
