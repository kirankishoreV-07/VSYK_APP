"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Calculator, Sparkles, Info, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";

// Foreman commission rate — mirrors the VSYK app (AuctionSettlementModal: commissionRate = 0.05).
const COMMISSION_RATE = 0.05;

export function ChitCalculator() {
  const [value, setValue] = useState(500000);
  const [months, setMonths] = useState(20);
  // Expected winning bid this cycle, as a % of the chit value (the auction discount).
  const [bidPct, setBidPct] = useState(15);

  const calc = useMemo(() => {
    const members = months; // a chit has one cycle (and one winner) per member
    const monthlyInstallment = value / months;
    const bid = (value * bidPct) / 100; // auction discount offered by the winner
    const commission = value * COMMISSION_RATE; // foreman commission on chit value
    const dividendPool = Math.max(bid - commission, 0); // shared among members
    const dividendPerMember = members > 0 ? dividendPool / members : 0;
    const netInstallment = Math.max(monthlyInstallment - dividendPerMember, 0);
    const prizeToWinner = Math.max(value - bid, 0);
    const savingsPct =
      monthlyInstallment > 0 ? (dividendPerMember / monthlyInstallment) * 100 : 0;
    // Illustrative lifetime view for a member who waits (never wins early).
    const totalContribution = netInstallment * months;
    const totalDividends = dividendPerMember * Math.max(months - 1, 0);
    return {
      members,
      monthlyInstallment,
      bid,
      commission,
      dividendPerMember,
      netInstallment,
      prizeToWinner,
      savingsPct,
      totalContribution,
      totalDividends,
    };
  }, [value, months, bidPct]);

  return (
    <section className="relative py-24 sm:py-28 lg:py-32">
      <div className="container-x">
        <SectionHeader
          eyebrow="Plan in 10 seconds"
          title={
            <>
              See your real numbers, <span className="text-gradient">cycle by cycle.</span>
            </>
          }
          description="Set the chit value, tenure and an expected auction bid. We use the same formula our settlement system does — commission, dividend and net installment included."
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mt-16 grid gap-6 lg:grid-cols-[1.05fr,1fr]"
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
                  <span className="font-display text-xl font-bold text-ink">{formatINR(value)}</span>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={5000000}
                  step={50000}
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="mt-3 w-full accent-brand-500"
                />
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-fade">
                  <span>₹1 L</span>
                  <span>₹50 L</span>
                </div>
              </div>

              {/* Tenure / members */}
              <div className="mt-7">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    Tenure &amp; members
                  </label>
                  <span className="font-display text-xl font-bold text-ink">
                    {months} months · {months} members
                  </span>
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

              {/* Expected bid */}
              <div className="mt-7">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                    Expected winning bid
                  </label>
                  <span className="font-display text-xl font-bold text-ink">
                    {bidPct}% · {formatINR(calc.bid)}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={bidPct}
                  onChange={(e) => setBidPct(Number(e.target.value))}
                  className="mt-3 w-full accent-brand-500"
                />
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-fade">
                  <span>5% (low demand)</span>
                  <span>30% (high demand)</span>
                </div>
              </div>

              <p className="mt-7 flex gap-2 rounded-2xl border border-brand-500/10 bg-brand-50/50 p-3.5 text-[12px] leading-relaxed text-brand-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-bold">How it works:</span> the winner accepts the chit value
                  minus their bid. A {Math.round(COMMISSION_RATE * 100)}% foreman commission is
                  deducted, and the rest of the bid is shared as a dividend that lowers everyone
                  else&apos;s installment that month.
                </span>
              </p>
            </div>
          </div>

          {/* Result */}
          <div className="relative overflow-hidden rounded-[2rem] bg-brand-gradient-deep p-7 text-white shadow-brand-lg sm:p-9">
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -top-12 h-60 w-60 rounded-full bg-brand-400/20 blur-3xl" />

            <div className="relative flex h-full flex-col">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-teal-300" /> This cycle
              </span>

              {/* Headline: net installment */}
              <div className="mt-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                  Net payable this month
                </p>
                <p className="font-display text-4xl font-bold leading-none text-white sm:text-5xl">
                  {formatINR(Math.round(calc.netInstallment))}
                </p>
                <p className="mt-1.5 text-[12px] text-white/65">
                  Gross installment {formatINR(Math.round(calc.monthlyInstallment))} −{" "}
                  {formatINR(Math.round(calc.dividendPerMember))} dividend
                </p>
              </div>

              {/* Breakdown grid */}
              <div className="mt-7 grid grid-cols-2 gap-3">
                <ResultCell
                  label="Dividend / member"
                  value={formatINR(Math.round(calc.dividendPerMember))}
                  accent
                />
                <ResultCell
                  label="Prize to winner"
                  value={formatINR(Math.round(calc.prizeToWinner))}
                />
                <ResultCell
                  label="Foreman commission"
                  value={formatINR(Math.round(calc.commission))}
                />
                <ResultCell label="Savings rate" value={`${calc.savingsPct.toFixed(1)}%`} accent />
              </div>

              {/* Lifetime illustrative */}
              <div className="mt-5 rounded-2xl border border-white/12 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                  If you wait the full tenure (illustrative)
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-white/60">Total dividends earned</p>
                    <p className="font-display text-xl font-bold text-teal-300">
                      {formatINR(Math.round(calc.totalDividends))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-white/60">Net outlay over {months} mo</p>
                    <p className="font-display text-xl font-bold text-white">
                      {formatINR(Math.round(calc.totalContribution))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <Link
                  href="/contact"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-brand-700 shadow-brand-md transition-all hover:-translate-y-0.5"
                >
                  Talk to an Advisor
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <p className="mt-3 text-center text-[11px] text-white/55">
                  Illustrative figures. Actual dividends vary with each month&apos;s winning bid.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ResultCell({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p
        className={`mt-0.5 font-display text-lg font-bold ${accent ? "text-teal-300" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
