"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, CreditCard, ArrowRight } from "lucide-react";
import { useMemberSession } from "@/lib/member-session";
import { useMemberChits } from "@/lib/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, EmptyState, Spinner, Input } from "@/components/app/ui";
import { formatPaiseCompact, cn } from "@/lib/utils";

type Filter = "all" | "active" | "completed" | "cash";

export default function ChitsPage() {
  const { memberId } = useMemberSession();
  const chits = useMemberChits(memberId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const list = chits.data ?? [];
    return list.filter((c) => {
      const g = c.chit_groups;
      if (!g) return false;
      if (search && !g.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filter === "active" && c.bid_status === "completed") return false;
      if (filter === "completed" && c.bid_status !== "completed") return false;
      if (filter === "cash" && g.accounting_type !== "unaccounted")
        return false;
      return true;
    });
  }, [chits.data, search, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cash", label: "Cash" },
  ];

  return (
    <>
      <PageHeader
        title="My Chits"
        subtitle="All your chit group memberships in one place."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search chit groups…"
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

      {chits.isLoading ? (
        <Card className="grid place-items-center py-16">
          <Spinner className="h-6 w-6 text-brand-500" />
        </Card>
      ) : !filtered.length ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No chits found"
          message={
            search || filter !== "all"
              ? "Try a different search or filter."
              : "You haven't joined any chit groups yet."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => {
            const g = c.chit_groups!;
            return (
              <Link key={c.id} href={`/app/chits/${c.id}`}>
                <Card className="h-full transition-shadow hover:shadow-brand-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{g.name}</p>
                      {g.group_code && (
                        <p className="text-xs text-ink-fade">{g.group_code}</p>
                      )}
                    </div>
                    <Badge
                      tone={
                        c.bid_status === "foreclosed"
                          ? "danger"
                          : c.bid_status === "completed"
                          ? "neutral"
                          : "success"
                      }
                    >
                      {c.bid_status || "active"}
                    </Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-surface-mute py-2">
                      <dt className="text-[10px] uppercase text-ink-fade">
                        Value
                      </dt>
                      <dd className="text-sm font-semibold text-ink">
                        {formatPaiseCompact(g.value)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-surface-mute py-2">
                      <dt className="text-[10px] uppercase text-ink-fade">
                        Monthly
                      </dt>
                      <dd className="text-sm font-semibold text-ink">
                        {formatPaiseCompact(g.monthly_installment)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-surface-mute py-2">
                      <dt className="text-[10px] uppercase text-ink-fade">
                        Ticket
                      </dt>
                      <dd className="text-sm font-semibold text-ink">
                        {c.ticket_number || "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge
                      tone={
                        g.accounting_type === "unaccounted" ? "brand" : "info"
                      }
                    >
                      {g.accounting_type === "unaccounted"
                        ? "Cash group"
                        : "Digital group"}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                      Details <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
