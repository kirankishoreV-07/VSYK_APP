"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Search, ChevronRight, Users } from "lucide-react";
import { useAdminGroups } from "@/lib/admin-queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, EmptyState, Spinner, Input } from "@/components/app/ui";
import { formatPaiseCompact, cn } from "@/lib/utils";

type Filter = "all" | "active" | "completed" | "cash";

export default function AdminGroupsPage() {
  const { data, isLoading } = useAdminGroups();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((g) => {
      if (search && !g.name?.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filter === "active" && g.status !== "active") return false;
      if (filter === "completed" && g.status !== "completed") return false;
      if (filter === "cash" && g.accounting_type !== "unaccounted") return false;
      return true;
    });
  }, [data, search, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cash", label: "Cash" },
  ];

  return (
    <>
      <PageHeader
        title="Chit Groups"
        subtitle={`${data?.length ?? 0} groups under management.`}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search groups…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-2xl bg-surface-mute p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                filter === f.key
                  ? "bg-white text-brand-700 shadow-soft"
                  : "text-ink-fade hover:text-ink-mute"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="grid place-items-center py-16">
          <Spinner className="h-6 w-6 text-brand-500" />
        </Card>
      ) : !filtered.length ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="No groups found"
          message="Try a different search or filter."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((g) => (
            <Link key={g.id} href={`/admin/groups/${g.id}`}>
              <Card className="h-full transition-shadow hover:shadow-brand-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{g.name}</p>
                    {g.group_code && (
                      <p className="text-xs text-ink-fade">{g.group_code}</p>
                    )}
                  </div>
                  <Badge
                    tone={
                      g.status === "active"
                        ? "success"
                        : g.status === "completed"
                        ? "neutral"
                        : "warning"
                    }
                  >
                    {g.status}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-surface-mute py-2">
                    <p className="text-[10px] uppercase text-ink-fade">Value</p>
                    <p className="text-sm font-semibold text-ink">
                      {formatPaiseCompact(g.value)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-mute py-2">
                    <p className="text-[10px] uppercase text-ink-fade">
                      Monthly
                    </p>
                    <p className="text-sm font-semibold text-ink">
                      {formatPaiseCompact(g.monthly_installment)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
                    <Users className="h-3.5 w-3.5" />
                    {g.chit_members?.length ?? 0} / {g.capacity ?? "—"} members
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-fade" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
