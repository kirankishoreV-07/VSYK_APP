"use client";

import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet as WalletIcon,
  RotateCcw,
} from "lucide-react";
import { useMemberSession } from "@/lib/member-session";
import { useWalletTransactions } from "@/lib/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, EmptyState, Spinner, StatCard } from "@/components/app/ui";
import { formatPaise, formatPaiseCompact, formatDateIST, cn } from "@/lib/utils";

export default function WalletPage() {
  const { memberId } = useMemberSession();
  const { data, isLoading } = useWalletTransactions(memberId);

  const totals = useMemo(() => {
    const list = data ?? [];
    let paid = 0;
    let refunded = 0;
    let failed = 0;
    for (const t of list) {
      if (t.status === "completed") paid += t.amount;
      else if (t.status === "refunded") refunded += t.amount;
      else if (t.status === "failed") failed += t.amount;
    }
    return { paid, refunded, failed, count: list.length };
  }, [data]);

  return (
    <>
      <PageHeader
        title="Wallet"
        subtitle="Your complete payment and transaction history."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Total Paid"
          value={formatPaiseCompact(totals.paid)}
          icon={<ArrowUpRight className="h-4 w-4" />}
          accent="emerald"
        />
        <StatCard
          label="Refunded"
          value={formatPaiseCompact(totals.refunded)}
          icon={<RotateCcw className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Transactions"
          value={totals.count}
          icon={<WalletIcon className="h-4 w-4" />}
          accent="brand"
        />
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">
        Transaction History
      </h2>

      {isLoading ? (
        <Card className="grid place-items-center py-16">
          <Spinner className="h-6 w-6 text-brand-500" />
        </Card>
      ) : !data?.length ? (
        <EmptyState
          icon={<WalletIcon className="h-6 w-6" />}
          title="No transactions yet"
          message="Your payments will appear here once recorded."
        />
      ) : (
        <Card className="divide-y divide-outline-soft p-0">
          {data.map((t) => {
            const isRefund = t.status === "refunded";
            const isFailed = t.status === "failed";
            return (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3.5">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    isFailed
                      ? "bg-rose-50 text-rose-600"
                      : isRefund
                      ? "bg-amber-50 text-amber-600"
                      : "bg-emerald-50 text-emerald-600"
                  )}
                >
                  {isRefund ? (
                    <RotateCcw className="h-5 w-5" />
                  ) : (
                    <ArrowDownLeft className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize text-ink">
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
                      isFailed
                        ? "text-ink-fade line-through"
                        : isRefund
                        ? "text-amber-600"
                        : "text-ink"
                    )}
                  >
                    {formatPaise(t.amount)}
                  </p>
                  <Badge
                    tone={
                      isFailed ? "danger" : isRefund ? "warning" : "success"
                    }
                  >
                    {t.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
