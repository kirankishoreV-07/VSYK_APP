"use client";

import { useMemo, useState } from "react";
import { Gavel, Trophy, CalendarClock, Radio } from "lucide-react";
import { useMemberSession } from "@/lib/member-session";
import { useMemberAuctions } from "@/lib/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, EmptyState, Spinner } from "@/components/app/ui";
import { formatPaiseCompact, formatDateIST, cn } from "@/lib/utils";

type Tab = "live" | "upcoming" | "completed";

export default function AuctionsPage() {
  const { memberId } = useMemberSession();
  const { data, isLoading } = useMemberAuctions(memberId);
  const [tab, setTab] = useState<Tab>("live");

  const grouped = useMemo(() => {
    const list = data ?? [];
    return {
      live: list.filter((a) => a.status === "live"),
      upcoming: list.filter((a) => a.status === "upcoming"),
      completed: list.filter((a) => a.status === "completed"),
    };
  }, [data]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "live", label: "Live", count: grouped.live.length },
    { key: "upcoming", label: "Upcoming", count: grouped.upcoming.length },
    { key: "completed", label: "Completed", count: grouped.completed.length },
  ];

  const current = grouped[tab];

  return (
    <>
      <PageHeader
        title="Auctions"
        subtitle="Live bidding and auction outcomes for your chit groups."
      />

      <div className="mb-5 flex gap-1 rounded-2xl bg-surface-mute p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all",
              tab === t.key
                ? "bg-white text-brand-700 shadow-soft"
                : "text-ink-fade hover:text-ink-mute"
            )}
          >
            {t.key === "live" && t.count > 0 && (
              <Radio className="h-3.5 w-3.5 text-rose-500" />
            )}
            {t.label}
            <span className="rounded-full bg-surface-deep px-1.5 text-[10px]">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card className="grid place-items-center py-16">
          <Spinner className="h-6 w-6 text-brand-500" />
        </Card>
      ) : !current.length ? (
        <EmptyState
          icon={<Gavel className="h-6 w-6" />}
          title={`No ${tab} auctions`}
          message="Auctions for your chit groups will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {current.map((a) => {
            const won = a.winner_member_id != null;
            return (
              <Card key={a.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {(a as any).chit_groups?.name || "Auction"}
                    </p>
                    <p className="text-xs text-ink-fade">
                      Auction #{a.auction_number}
                    </p>
                  </div>
                  {a.status === "live" ? (
                    <Badge tone="danger">
                      <Radio className="h-3 w-3" /> Live
                    </Badge>
                  ) : a.status === "upcoming" ? (
                    <Badge tone="info">Upcoming</Badge>
                  ) : (
                    <Badge tone="neutral">Completed</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-ink-fade">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDateIST(a.scheduled_at, true)}
                </div>

                {a.status === "completed" && (
                  <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2.5">
                    <Trophy className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">
                      {a.winner_name || "Winner declared"}
                    </span>
                    {a.winner_prize_amount != null && (
                      <span className="ml-auto text-sm font-semibold text-amber-800">
                        {formatPaiseCompact(a.winner_prize_amount)}
                      </span>
                    )}
                  </div>
                )}

                {(a.status === "live" || a.status === "upcoming") && (
                  <div className="flex justify-between rounded-2xl bg-surface-mute px-3 py-2.5 text-sm">
                    <span className="text-ink-fade">
                      {a.current_bid ? "Current bid" : "Min bid"}
                    </span>
                    <span className="font-semibold text-ink">
                      {formatPaiseCompact(a.current_bid || a.min_bid)}
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
