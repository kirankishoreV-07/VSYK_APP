"use client";

import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  Layers,
  Gavel,
  ArrowRight,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";
import { useMemberSession } from "@/lib/member-session";
import {
  useDashboardStats,
  useActiveChits,
  useUpcomingAuctions,
} from "@/lib/queries";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  StatCard,
  Badge,
  EmptyState,
  Spinner,
  ProgressBar,
} from "@/components/app/ui";
import { formatPaise, formatPaiseCompact, formatDateIST, cn } from "@/lib/utils";

export default function DashboardPage() {
  const { memberId, memberProfile } = useMemberSession();
  const stats = useDashboardStats(memberId);
  const chits = useActiveChits(memberId);
  const auctions = useUpcomingAuctions(memberId);

  const firstName = memberProfile?.full_name?.split(" ")[0] || "Member";
  const kyc = (memberProfile?.kyc_status || "pending").toLowerCase();
  const healthScore = kyc === "verified" ? 92 : kyc === "pending" ? 64 : 40;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's a snapshot of your chit fund portfolio."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Portfolio Value"
          value={
            stats.isLoading ? (
              <Spinner className="h-5 w-5 text-brand-500" />
            ) : (
              formatPaiseCompact(stats.data?.total_portfolio_value)
            )
          }
          icon={<Wallet className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Total Earnings"
          value={
            stats.isLoading ? (
              <Spinner className="h-5 w-5 text-teal-500" />
            ) : (
              formatPaiseCompact(stats.data?.total_earnings)
            )
          }
          icon={<TrendingUp className="h-4 w-4" />}
          accent="teal"
        />
        <StatCard
          label="Active Chits"
          value={
            stats.isLoading ? (
              <Spinner className="h-5 w-5 text-amber-500" />
            ) : (
              (stats.data?.active_chit_count ?? 0)
            )
          }
          icon={<Layers className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Account Health"
          value={`${healthScore}%`}
          sub={
            <Badge tone={kyc === "verified" ? "success" : "warning"}>
              <ShieldCheck className="h-3 w-3" /> KYC {kyc}
            </Badge>
          }
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="emerald"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Active chits */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Active Chits</h2>
            <Link
              href="/app/chits"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {chits.isLoading ? (
            <Card className="grid place-items-center py-12">
              <Spinner className="h-6 w-6 text-brand-500" />
            </Card>
          ) : !chits.data?.length ? (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="No active chits yet"
              message="When you join a chit group, it will show up here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {chits.data.map((c) => {
                const total = c.chit_group.duration_months || 1;
                const done = c.current_month || 0;
                const pct = Math.round((done / total) * 100);
                return (
                  <Link key={c.membership_id} href={`/app/chits/${c.membership_id}`}>
                    <Card className="transition-shadow hover:shadow-brand-md">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">
                            {c.chit_group.name}
                          </p>
                          <p className="text-xs text-ink-fade">
                            {formatPaiseCompact(c.chit_group.value)} ·{" "}
                            {c.chit_group.duration_months} months
                          </p>
                        </div>
                        <Badge
                          tone={
                            c.chit_group.accounting_type === "unaccounted"
                              ? "brand"
                              : "info"
                          }
                        >
                          {c.chit_group.accounting_type === "unaccounted"
                            ? "Cash"
                            : "Digital"}
                        </Badge>
                      </div>
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-xs text-ink-fade">
                          <span>
                            Month {done} of {total}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <ProgressBar value={pct} />
                      </div>
                      {c.next_payment && (
                        <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-mute px-3 py-2.5">
                          <span className="text-xs text-ink-mute">
                            Next due {formatDateIST(c.next_payment.due_date)}
                          </span>
                          <span className="text-sm font-semibold text-ink">
                            {formatPaise(c.next_payment.amount)}
                          </span>
                        </div>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming auctions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">
              Upcoming Auctions
            </h2>
            <Link
              href="/app/auctions"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
            >
              All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {auctions.isLoading ? (
            <Card className="grid place-items-center py-12">
              <Spinner className="h-6 w-6 text-brand-500" />
            </Card>
          ) : !auctions.data?.length ? (
            <EmptyState
              icon={<Gavel className="h-6 w-6" />}
              title="No upcoming auctions"
              message="Auctions for your groups will appear here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {auctions.data.map((a) => (
                <Card key={a.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
                    <Gavel className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {a.chit_group?.name || "Auction"}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-ink-fade">
                      <CalendarClock className="h-3 w-3" />
                      {formatDateIST(a.scheduled_at, true)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
