"use client";

import { motion } from "framer-motion";
import { Check, X, Minus, Sparkles } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils";

type Cell = { rating: "yes" | "no" | "partial"; text: string };

const COLUMNS = ["Chit Fund", "Bank Deposit", "Mutual Fund", "Gold Loan"] as const;

const ROWS: { label: string; cells: Cell[] }[] = [
  {
    label: "Disciplined monthly savings",
    cells: [
      { rating: "yes", text: "Built-in commitment" },
      { rating: "partial", text: "Only with RD" },
      { rating: "partial", text: "SIP optional" },
      { rating: "no", text: "Not a savings tool" },
    ],
  },
  {
    label: "Early access to a lump sum",
    cells: [
      { rating: "yes", text: "Bid any month" },
      { rating: "no", text: "Locked till maturity" },
      { rating: "partial", text: "Redeem at market price" },
      { rating: "yes", text: "But you pledge gold" },
    ],
  },
  {
    label: "Returns / earnings",
    cells: [
      { rating: "yes", text: "Dividends each cycle" },
      { rating: "partial", text: "Fixed, modest" },
      { rating: "partial", text: "Market-linked" },
      { rating: "no", text: "You pay interest" },
    ],
  },
  {
    label: "Market-risk free",
    cells: [
      { rating: "yes", text: "Predictable" },
      { rating: "yes", text: "Predictable" },
      { rating: "no", text: "Volatile" },
      { rating: "yes", text: "No market link" },
    ],
  },
  {
    label: "No collateral / pledge",
    cells: [
      { rating: "yes", text: "None needed" },
      { rating: "yes", text: "None needed" },
      { rating: "yes", text: "None needed" },
      { rating: "no", text: "Gold pledged" },
    ],
  },
  {
    label: "Full transparency",
    cells: [
      { rating: "yes", text: "Every bid visible" },
      { rating: "partial", text: "Statement only" },
      { rating: "partial", text: "NAV only" },
      { rating: "partial", text: "Interest terms" },
    ],
  },
  {
    label: "Best suited for",
    cells: [
      { rating: "yes", text: "Save + access" },
      { rating: "partial", text: "Park idle cash" },
      { rating: "partial", text: "Long-term growth" },
      { rating: "no", text: "Short-term borrowing" },
    ],
  },
];

const RATING_ICON = {
  yes: { Icon: Check, cls: "bg-teal-500/12 text-teal-600" },
  no: { Icon: X, cls: "bg-rose-500/10 text-rose-500" },
  partial: { Icon: Minus, cls: "bg-amber-500/12 text-amber-600" },
};

export function ComparisonMatrix() {
  return (
    <section className="relative py-20 sm:py-24 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-brand-50/50 to-transparent" />
      <div className="container-x">
        <SectionHeader
          eyebrow="Side-by-side"
          title={
            <>
              Chit funds vs <span className="text-gradient">the alternatives.</span>
            </>
          }
          description="See how a chit fund compares with bank deposits, mutual funds and gold loans across the things that actually matter to a family's finances."
        />

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mt-14 overflow-hidden rounded-3xl border border-outline-soft bg-white shadow-brand-md"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white py-5 pl-6 pr-4 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    Compare
                  </th>
                  {COLUMNS.map((c, i) => {
                    const highlight = i === 0;
                    return (
                      <th
                        key={c}
                        className={cn(
                          "px-4 py-5 text-center align-bottom",
                          highlight && "bg-gradient-to-b from-brand-500/[0.08] to-transparent"
                        )}
                      >
                        {highlight && (
                          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-teal-500 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-brand-sm">
                            <Sparkles className="h-3 w-3" /> VSYK
                          </span>
                        )}
                        <span
                          className={cn(
                            "block font-display text-base font-bold",
                            highlight ? "text-brand-700" : "text-ink"
                          )}
                        >
                          {c}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-outline-soft">
                    <td className="sticky left-0 z-10 bg-white py-4 pl-6 pr-4 text-[13px] font-semibold text-ink">
                      {row.label}
                    </td>
                    {row.cells.map((cell, i) => {
                      const highlight = i === 0;
                      const { Icon, cls } = RATING_ICON[cell.rating];
                      return (
                        <td
                          key={i}
                          className={cn(
                            "px-4 py-4 text-center",
                            highlight && "bg-gradient-to-b from-brand-500/[0.06] to-transparent"
                          )}
                        >
                          <span
                            className={cn(
                              "mx-auto mb-1.5 grid h-7 w-7 place-items-center rounded-full",
                              cls
                            )}
                          >
                            <Icon className="h-4 w-4" strokeWidth={3} />
                          </span>
                          <span
                            className={cn(
                              "block text-[12px] leading-tight",
                              highlight ? "font-semibold text-brand-800" : "text-ink-mute"
                            )}
                          >
                            {cell.text}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <p className="mt-4 text-center text-[12px] text-ink-fade">
          Indicative comparison for general guidance. Each instrument has its place — many families
          use a chit fund alongside deposits and investments.
        </p>
      </div>
    </section>
  );
}
