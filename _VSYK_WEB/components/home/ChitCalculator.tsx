"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Calculator, Sparkles } from "lucide-react";
import { formatINR } from "@/lib/utils";

export function ChitCalculator() {
  const [amount, setAmount] = useState(500000);
  const [months, setMonths] = useState(20);

  const monthly = useMemo(() => Math.round(amount / months), [amount, months]);
  const estDividend = useMemo(() => Math.round(amount * 0.04), [amount]);

  return (
    <section className="relative py-24 sm:py-28 lg:py-32">
      <div className="container-x">
        <SectionHeader
          eyebrow="Plan in 10 seconds"
          title={
            <>
              See your savings, <span className="text-gradient">at a glance.</span>
            </>
          }
          description="Pick a chit value and tenure. We'll show you the monthly contribution and your estimated dividend share."
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mt-16 grid gap-6 lg:grid-cols-[1.1fr,1fr]"
        >
          {/* Inputs */}
          <div className="relative overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-7 shadow-brand-md sm:p-9">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-teal-300/15 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Calculator className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-lg font-bold text-ink">Chit Calculator</p>
                  <p className="text-xs text-ink-fade">Instant. No signup needed.</p>
                </div>
              </div>

              {/* Chit value */}
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    Chit value
                  </label>
                  <span className="font-display text-xl font-bold text-ink">
                    {formatINR(amount)}
                  </span>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={5000000}
                  step={50000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="mt-3 w-full accent-brand-500"
                />
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-fade">
                  <span>₹1 L</span>
                  <span>₹50 L</span>
                </div>
              </div>

              {/* Tenure */}
              <div className="mt-7">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    Tenure
                  </label>
                  <span className="font-display text-xl font-bold text-ink">{months} months</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={40}
                  step={1}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="mt-3 w-full accent-brand-500"
                />
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-fade">
                  <span>10</span>
                  <span>40</span>
                </div>
              </div>

              <p className="mt-7 rounded-2xl border border-brand-500/10 bg-brand-50/50 p-3.5 text-[12px] leading-relaxed text-brand-800">
                <span className="font-bold">Illustrative figures.</span> Final installments &amp;
                dividends depend on the chosen scheme and auction outcomes each month.
              </p>
            </div>
          </div>

          {/* Result */}
          <div className="relative overflow-hidden rounded-[2rem] bg-brand-gradient-deep p-7 text-white shadow-brand-lg sm:p-9">
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -top-12 h-60 w-60 rounded-full bg-brand-400/20 blur-3xl" />

            <div className="relative flex h-full flex-col">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-teal-300" /> Estimated
              </span>

              <div className="mt-7 space-y-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                    Monthly installment
                  </p>
                  <p className="font-display text-4xl font-bold leading-none text-white sm:text-5xl">
                    {formatINR(monthly)}
                  </p>
                  <p className="mt-1 text-[12px] text-white/65">paid each month for {months} months</p>
                </div>

                <div className="h-px w-full bg-white/15" />

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                    Estimated dividend share
                  </p>
                  <p className="font-display text-2xl font-bold text-teal-300 sm:text-3xl">
                    {formatINR(estDividend)}
                  </p>
                  <p className="mt-1 text-[12px] text-white/65">
                    over the chit lifetime when you don&apos;t bid
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <a
                  href="/schemes"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-brand-700 shadow-brand-md transition-all hover:-translate-y-0.5"
                >
                  Match this to a real scheme
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
