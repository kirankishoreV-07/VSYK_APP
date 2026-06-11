"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  IndianRupee,
  Calendar,
  Users,
  CheckCircle2,
  TrendingUp,
  Flame,
  Sparkles,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ChitCalculator } from "@/components/home/ChitCalculator";
import { FAQ } from "@/components/home/FAQ";
import { cn, formatINRCompact } from "@/lib/utils";

type Scheme = {
  id: string;
  name: string;
  value: number;
  months: number;
  monthly: number;
  members: number;
  category: "starter" | "family" | "business" | "premium";
  featured?: boolean;
  highlights: string[];
};

const SCHEMES: Scheme[] = [
  {
    id: "sunrise-1l",
    name: "Sunrise · 1L",
    value: 100000,
    months: 20,
    monthly: 5000,
    members: 20,
    category: "starter",
    highlights: ["Perfect first chit", "Quick auctions", "Low entry barrier"],
  },
  {
    id: "horizon-2l",
    name: "Horizon · 2L",
    value: 200000,
    months: 20,
    monthly: 10000,
    members: 20,
    category: "family",
    featured: true,
    highlights: ["Most popular", "School & medical use cases", "Strong dividends"],
  },
  {
    id: "summit-5l",
    name: "Summit · 5L",
    value: 500000,
    months: 25,
    monthly: 20000,
    members: 25,
    category: "family",
    highlights: ["Home down-payments", "Wedding planning", "Higher pool"],
  },
  {
    id: "venture-10l",
    name: "Venture · 10L",
    value: 1000000,
    months: 30,
    monthly: 33333,
    members: 30,
    category: "business",
    highlights: ["Working capital", "Business expansion", "Higher bid ceilings"],
  },
  {
    id: "horizon-3l",
    name: "Horizon · 3L",
    value: 300000,
    months: 24,
    monthly: 12500,
    members: 24,
    category: "family",
    highlights: ["Higher education", "Family vacations", "Balanced tenure"],
  },
  {
    id: "elite-25l",
    name: "Elite · 25L",
    value: 2500000,
    months: 30,
    monthly: 83333,
    members: 30,
    category: "premium",
    highlights: ["Premium member pool", "Large life goals", "Concierge support"],
  },
  {
    id: "sunrise-2l",
    name: "Sunrise · 2L",
    value: 200000,
    months: 24,
    monthly: 8333,
    members: 24,
    category: "starter",
    highlights: ["Salaried-friendly", "Lighter monthly load", "Beginner-tier"],
  },
  {
    id: "venture-15l",
    name: "Venture · 15L",
    value: 1500000,
    months: 30,
    monthly: 50000,
    members: 30,
    category: "business",
    highlights: ["Inventory & expansion", "MSME-aligned", "Auction priority"],
  },
];

const FILTERS = [
  { id: "all", label: "All Schemes", icon: Sparkles },
  { id: "starter", label: "Starter", icon: TrendingUp },
  { id: "family", label: "Family", icon: Users },
  { id: "business", label: "Business", icon: IndianRupee },
  { id: "premium", label: "Premium", icon: Flame },
] as const;

export default function SchemesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const filtered = useMemo(
    () => (filter === "all" ? SCHEMES : SCHEMES.filter((s) => s.category === filter)),
    [filter]
  );

  return (
    <>
      <PageHero
        eyebrow="Chit Schemes"
        title={
          <>
            Find the plan that <span className="text-gradient">matches your milestone.</span>
          </>
        }
        description="Curated schemes for every stage — from your very first chit to premium family corpus. Browse, compare, and join in minutes."
      />

      {/* Filters */}
      <section className="relative -mt-2 pb-4">
        <div className="container-x">
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-outline-soft bg-white p-2 shadow-brand-sm sm:mx-auto sm:max-w-3xl">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                    active ? "text-white" : "text-ink/70 hover:text-brand-700"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="scheme-filter"
                      className="absolute inset-0 rounded-full bg-brand-500 shadow-premium"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <f.icon className="relative h-3.5 w-3.5" />
                  <span className="relative">{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="relative py-12 sm:py-16">
        <div className="container-x">
          <motion.div layout className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((s, i) => (
                <SchemeCard key={s.id} scheme={s} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Comparison */}
      <section className="relative py-20 sm:py-24">
        <div className="container-x">
          <SectionHeader
            eyebrow="Side-by-side"
            title={
              <>
                Compare the <span className="text-gradient">most popular</span> picks.
              </>
            }
            description="Three schemes our members love most — laid out so you can see the trade-offs at a glance."
          />
          <div className="mt-14 overflow-hidden rounded-3xl border border-outline-soft bg-white shadow-brand-md">
            <ComparisonTable />
          </div>
        </div>
      </section>

      <ChitCalculator />
      <FAQ />
    </>
  );
}

function SchemeCard({ scheme, index }: { scheme: Scheme; index: number }) {
  const isFeatured = scheme.featured;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay: index * 0.04 }}
      className={cn(
        "group relative overflow-hidden rounded-[1.75rem] border bg-white p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-brand-lg",
        isFeatured
          ? "border-brand-500/40 shadow-brand-md ring-2 ring-brand-500/10"
          : "border-outline-soft shadow-brand-sm"
      )}
    >
      {isFeatured && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-teal-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-brand-md">
          <Flame className="h-3 w-3" /> Popular
        </span>
      )}

      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-teal-300/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
          {scheme.name.split(" · ")[0]} Series
        </p>
        <h3 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
          {scheme.name}
        </h3>
        <p className="mt-1 text-sm text-ink-fade">
          Chit value · <span className="font-bold text-ink">{formatINRCompact(scheme.value)}</span>
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-outline-soft bg-surface-mute/60 p-3">
        <Stat icon={IndianRupee} label="Monthly" value={formatINRCompact(scheme.monthly)} />
        <Stat icon={Calendar} label="Tenure" value={`${scheme.months} mo`} />
        <Stat icon={Users} label="Members" value={`${scheme.members}`} />
      </div>

      <ul className="mt-6 space-y-2.5">
        {scheme.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2.5 text-sm text-ink-mute">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
            <span>{h}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex items-center gap-2">
        <Link
          href="/contact"
          className={cn(
            "group/btn inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-premium transition-all hover:-translate-y-0.5",
            isFeatured
              ? "bg-gradient-to-r from-brand-500 to-teal-500 text-white hover:shadow-brand-xl"
              : "bg-brand-500 text-white hover:bg-brand-600 hover:shadow-brand-xl"
          )}
        >
          Join This Scheme
          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
        </Link>
      </div>
    </motion.article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5 rounded-xl bg-white px-3 py-2.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-fade">
        <Icon className="h-3 w-3 text-brand-500" /> {label}
      </span>
      <span className="font-display text-sm font-bold text-ink">{value}</span>
    </div>
  );
}

function ComparisonTable() {
  const cols = [
    { name: "Sunrise · 1L", monthly: "₹5,000", tenure: "20 months", members: "20", dividend: "Moderate", best: "First chit" },
    { name: "Horizon · 2L", monthly: "₹10,000", tenure: "20 months", members: "20", dividend: "Strong", best: "Family savings" },
    { name: "Summit · 5L", monthly: "₹20,000", tenure: "25 months", members: "25", dividend: "Strong", best: "Big milestones" },
  ];
  const rows = [
    { key: "monthly", label: "Monthly installment" },
    { key: "tenure", label: "Tenure" },
    { key: "members", label: "Members" },
    { key: "dividend", label: "Dividend earning" },
    { key: "best", label: "Best for" },
  ] as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="bg-brand-50/50">
            <th className="py-4 pl-6 pr-4 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
              Compare
            </th>
            {cols.map((c, i) => (
              <th
                key={c.name}
                className={cn(
                  "py-4 px-4 font-display text-base font-bold text-ink",
                  i === 1 && "bg-gradient-to-b from-brand-500/5 to-transparent"
                )}
              >
                {c.name}
                {i === 1 && (
                  <span className="ml-2 rounded-full bg-gradient-to-r from-brand-500 to-teal-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    Popular
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-outline-soft">
              <td className="py-4 pl-6 pr-4 text-[13px] font-semibold text-ink-fade">{r.label}</td>
              {cols.map((c, i) => (
                <td
                  key={c.name}
                  className={cn(
                    "py-4 px-4 text-sm text-ink",
                    i === 1 && "bg-gradient-to-b from-brand-500/5 to-transparent font-semibold"
                  )}
                >
                  {c[r.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
