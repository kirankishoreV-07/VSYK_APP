"use client";

import {
  Wallet,
  Users,
  Banknote,
  Gavel,
  TrendingUp,
  ArrowDownLeft,
} from "lucide-react";
import { useAdminDashboard } from "@/lib/admin-queries";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  StatCard,
  Badge,
  EmptyState,
  Spinner,
} from "@/components/app/ui";
import {
  formatINRCompact,
  formatPaiseCompact,
  formatDateIST,
} from "@/lib/utils";

export default function AdminDashboardPage() {
  const { data, isLoading } = useAdminDashboard();
  const m = data?.metrics;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Portfolio-wide performance across all chit groups."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total AUM"
          value={
            isLoading ? <Spinner className="h-5 w-5" /> : formatINRCompact(m?.totalAUM ?? 0)
          }
          icon={<Wallet className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Members"
          value={isLoading ? <Spinner className="h-5 w-5" /> : (m?.members ?? 0)}
          icon={<Users className="h-4 w-4" />}
          accent="teal"
        />
        <StatCard
          label="Collection"
          value={
            isLoading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              formatPaiseCompact(m?.collection ?? 0)
            )
          }
          icon={<Banknote className="h-4 w-4" />}
          accent="emerald"
        />
        <StatCard
          label="Active Auctions"
          value={isLoading ? <Spinner className="h-5 w-5" /> : (m?.auctions ?? 0)}
          icon={<Gavel className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Dividends"
          value={
            isLoading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              formatPaiseCompact(m?.dividends ?? 0)
            )
          }
          icon={<TrendingUp className="h-4 w-4" />}
          accent="rose"
        />
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">
        Recent Activity
      </h2>
      {isLoading ? (
        <Card className="grid place-items-center py-16">
          <Spinner className="h-6 w-6 text-brand-500" />
        </Card>
      ) : !data?.activity.length ? (
        <EmptyState
          icon={<Banknote className="h-6 w-6" />}
          title="No recent activity"
          message="Collections and payments will show up here."
        />
      ) : (
        <Card className="divide-y divide-outline-soft p-0">
          {data.activity.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-4 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <ArrowDownLeft className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {a.customer}
                </p>
                <p className="truncate text-xs text-ink-fade">
                  {a.group} · {a.label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink">
                  {formatPaiseCompact(a.amount)}
                </p>
                <p className="text-xs text-ink-fade">
                  {formatDateIST(a.date)}
                </p>
              </div>
              <Badge tone={a.kind === "cash" ? "brand" : "info"}>
                {a.kind === "cash" ? "Cash" : "Digital"}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
