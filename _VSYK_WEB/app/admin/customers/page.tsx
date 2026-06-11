"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, ChevronRight, ShieldCheck } from "lucide-react";
import { useAdminCustomers } from "@/lib/admin-queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, EmptyState, Spinner, Input } from "@/components/app/ui";
import { formatDateIST, cn } from "@/lib/utils";

type Filter = "all" | "verified" | "pending" | "company";

export default function AdminCustomersPage() {
  const { data, isLoading } = useAdminCustomers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((c) => {
      const kyc = (c.kyc_status || "pending").toLowerCase();
      if (
        search &&
        !`${c.full_name} ${c.phone} ${c.customer_id ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (filter === "verified" && kyc !== "verified") return false;
      if (filter === "pending" && kyc === "verified") return false;
      if (filter === "company" && c.customer_type !== "Company") return false;
      return true;
    });
  }, [data, search, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "verified", label: "Verified" },
    { key: "pending", label: "Pending" },
    { key: "company", label: "Company" },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${data?.length ?? 0} registered customers.`}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name, phone or ID…"
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
          icon={<Users className="h-6 w-6" />}
          title="No customers found"
          message="Try a different search or filter."
        />
      ) : (
        <Card className="divide-y divide-outline-soft p-0">
          {filtered.map((c) => {
            const kyc = (c.kyc_status || "pending").toLowerCase();
            const initials = (c.full_name || "?")
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <Link
                key={c.id}
                href={`/admin/customers/${c.id}`}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-mute"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {c.full_name}
                  </p>
                  <p className="truncate text-xs text-ink-fade">
                    {c.customer_id ? `${c.customer_id} · ` : ""}
                    {c.phone}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-xs text-ink-fade">
                    Joined {formatDateIST(c.created_at)}
                  </p>
                </div>
                <Badge tone={kyc === "verified" ? "success" : "warning"}>
                  <ShieldCheck className="h-3 w-3" /> {kyc}
                </Badge>
                <ChevronRight className="h-4 w-4 text-ink-fade" />
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
