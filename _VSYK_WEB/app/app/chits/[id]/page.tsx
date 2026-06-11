"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trophy,
  Banknote,
} from "lucide-react";
import { useChitDetail } from "@/lib/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, Spinner, EmptyState } from "@/components/app/ui";
import {
  formatPaise,
  formatPaiseCompact,
  formatDateIST,
  paiseToRupees,
  formatINR,
  cn,
} from "@/lib/utils";
import type { Auction, PaymentSchedule } from "@/lib/types";

type MonthStatus = "full" | "partial" | "unpaid" | "won" | "upcoming";

export default function ChitDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;
  const { data, isLoading } = useChitDetail(id);

  const rows = useMemo(() => {
    if (!data) return [];
    const { schedules, transactions, auctions, member } = data;
    const wonMonths = new Set(
      auctions
        .filter((a) => a.winner_member_id === member.id && a.auction_number)
        .map((a) => a.auction_number)
    );

    const byMonth = new Map<number, PaymentSchedule>();
    schedules.forEach((s) => byMonth.set(s.month_number, s));

    const sumPaidForMonth = (monthNo: number) => {
      // Sum completed minus refunded transactions linked to that month's auction.
      const auctionId = auctions.find((a) => a.auction_number === monthNo)?.id;
      return transactions
        .filter(
          (t) =>
            (auctionId ? t.auction_id === auctionId : false) ||
            (t.notes ? t.notes.includes(`month ${monthNo}`) : false)
        )
        .reduce((acc, t) => {
          if (t.status === "completed") return acc + t.amount;
          if (t.status === "refunded") return acc - t.amount;
          return acc;
        }, 0);
    };

    const total = member.chit_groups?.duration_months || schedules.length;
    const list: {
      month: number;
      due: number;
      paid: number;
      status: MonthStatus;
      dueDate?: string | null;
    }[] = [];

    for (let m = 1; m <= total; m++) {
      const sched = byMonth.get(m);
      const due = sched?.amount ?? 0;
      const paid = sumPaidForMonth(m);
      let status: MonthStatus;
      if (wonMonths.has(m)) status = "won";
      else if (sched?.paid || (due > 0 && paid >= due)) status = "full";
      else if (paid > 0) status = "partial";
      else if (!sched) status = "upcoming";
      else status = "unpaid";
      list.push({
        month: m,
        due,
        paid,
        status,
        dueDate: sched?.due_date,
      });
    }
    return list;
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Chit not found"
        message="This membership could not be loaded."
        action={
          <Link href="/app/chits" className="text-sm font-semibold text-brand-600">
            Back to My Chits
          </Link>
        }
      />
    );
  }

  const g = data.member.chit_groups!;
  const isCash = g.accounting_type === "unaccounted";
  const paidTotal = rows.reduce((a, r) => a + Math.max(0, r.paid), 0);
  const dueTotal = rows.reduce((a, r) => a + r.due, 0);

  return (
    <>
      <Link
        href="/app/chits"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> My Chits
      </Link>

      <PageHeader
        title={g.name}
        subtitle={`${formatPaiseCompact(g.value)} · ${g.duration_months} months · ${
          isCash ? "Cash group" : "Digital group"
        }`}
        action={
          data.member.bid_status === "foreclosed" ? (
            <Badge tone="danger">Foreclosed</Badge>
          ) : (
            <Badge tone="success">{data.member.bid_status || "active"}</Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryStat label="Chit Value" value={formatPaiseCompact(g.value)} />
        <SummaryStat
          label="Monthly"
          value={formatPaiseCompact(g.monthly_installment)}
        />
        <SummaryStat label="Total Paid" value={formatINR(paiseToRupees(paidTotal))} />
        <SummaryStat
          label="Ticket"
          value={data.member.ticket_number || "—"}
        />
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">
        Payment Timeline
      </h2>
      <Card className="divide-y divide-outline-soft p-0">
        {rows.map((r) => (
          <div key={r.month} className="flex items-center gap-4 px-4 py-3.5">
            <StatusIcon status={r.status} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Month {r.month}</p>
              <p className="text-xs text-ink-fade">
                {r.dueDate ? `Due ${formatDateIST(r.dueDate)}` : "Not scheduled"}
                {isCash && r.status !== "upcoming" ? " · Cash" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-ink">
                {r.due > 0 ? formatPaise(r.due) : "—"}
              </p>
              {r.status === "partial" && (
                <p className="text-xs text-amber-600">
                  {formatPaise(r.paid)} paid
                </p>
              )}
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </Card>
    </>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="py-4">
      <p className="text-xs uppercase tracking-wide text-ink-fade">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </Card>
  );
}

function StatusIcon({ status }: { status: MonthStatus }) {
  const map = {
    full: { Icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
    won: { Icon: Trophy, cls: "bg-amber-50 text-amber-600" },
    partial: { Icon: Banknote, cls: "bg-amber-50 text-amber-600" },
    unpaid: { Icon: AlertCircle, cls: "bg-rose-50 text-rose-600" },
    upcoming: { Icon: Clock, cls: "bg-surface-mute text-ink-fade" },
  } as const;
  const { Icon, cls } = map[status];
  return (
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", cls)}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function StatusBadge({ status }: { status: MonthStatus }) {
  const map: Record<MonthStatus, { tone: any; label: string }> = {
    full: { tone: "success", label: "Paid" },
    won: { tone: "warning", label: "Won" },
    partial: { tone: "warning", label: "Partial" },
    unpaid: { tone: "danger", label: "Due" },
    upcoming: { tone: "neutral", label: "Upcoming" },
  };
  const { tone, label } = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
