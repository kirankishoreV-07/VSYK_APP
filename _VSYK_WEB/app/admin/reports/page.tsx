"use client";

import { useMemo } from "react";
import { Layers, Wallet, Users, Gavel } from "lucide-react";
import { useAdminGroups, useAdminDashboard } from "@/lib/admin-queries";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  StatCard,
  Badge,
  EmptyState,
  Spinner,
  ProgressBar,
} from "@/components/app/ui";
import { formatPaiseCompact, formatINRCompact } from "@/lib/utils";

export default function AdminReportsPage() {
  const groups = useAdminGroups();
  const dash = useAdminDashboard();

  const breakdown = useMemo(() => {
    const list = groups.data ?? [];
    const totalValue = list.reduce((a, g) => a + Number(g.value || 0), 0);
    const byStatus = {
      active: list.filter((g) => g.status === "active").length,
      completed: list.filter((g) => g.status === "completed").length,
      cash: list.filter((g) => g.accounting_type === "unaccounted").length,
      digital: list.filter((g) => g.accounting_type !== "unaccounted").length,
    };
    const ranked = [...list]
      .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
      .slice(0, 8)
      .map((g) => ({
        id: g.id,
        name: g.name,
        value: Number(g.value || 0),
        members: g.chit_members?.length ?? 0,
        share: totalValue > 0 ? (Number(g.value || 0) / totalValue) * 100 : 0,
      }));
    return { totalValue, byStatus, ranked };
  }, [groups.data]);

  const isLoading = groups.isLoading || dash.isLoading;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Portfolio analytics and group breakdowns."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total AUM"
          value={
            isLoading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              formatINRCompact(dash.data?.metrics.totalAUM ?? 0)
            )
          }
          icon={<Wallet className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Groups"
          value={groups.data?.length ?? 0}
          icon={<Layers className="h-4 w-4" />}
          accent="teal"
        />
        <StatCard
          label="Members"
          value={dash.data?.metrics.members ?? 0}
          icon={<Users className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Active Auctions"
          value={dash.data?.metrics.auctions ?? 0}
          icon={<Gavel className="h-4 w-4" />}
          accent="emerald"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-ink">
            Group Composition
          </h3>
          <div className="flex flex-col gap-3">
            <CompositionRow
              label="Active"
              value={breakdown.byStatus.active}
              tone="success"
            />
            <CompositionRow
              label="Completed"
              value={breakdown.byStatus.completed}
              tone="neutral"
            />
            <CompositionRow
              label="Digital"
              value={breakdown.byStatus.digital}
              tone="info"
            />
            <CompositionRow
              label="Cash"
              value={breakdown.byStatus.cash}
              tone="brand"
            />
          </div>
        </Card>

        <div className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-ink">
            Top Groups by Value
          </h3>
          {groups.isLoading ? (
            <Card className="grid place-items-center py-12">
              <Spinner className="h-6 w-6 text-brand-500" />
            </Card>
          ) : !breakdown.ranked.length ? (
            <EmptyState title="No groups to report" />
          ) : (
            <Card className="flex flex-col gap-4">
              {breakdown.ranked.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate font-medium text-ink">
                      {g.name}
                    </span>
                    <span className="shrink-0 font-semibold text-ink">
                      {formatPaiseCompact(g.value)}
                    </span>
                  </div>
                  <ProgressBar value={g.share} />
                  <p className="mt-1 text-xs text-ink-fade">
                    {g.members} members · {g.share.toFixed(1)}% of AUM
                  </p>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function CompositionRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: any;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface-mute px-4 py-3">
      <span className="text-sm text-ink-mute">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
