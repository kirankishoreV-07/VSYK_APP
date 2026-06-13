"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Gavel,
  Timer,
  Users,
  TrendingDown,
  Eye,
  ShieldCheck,
  Activity,
  ArrowRight,
  Trophy,
  Coins,
  Receipt,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FAQ } from "@/components/home/FAQ";
import { formatINRCompact } from "@/lib/utils";

const PRINCIPLES = [
  {
    icon: Eye,
    title: "Visible to all members",
    desc: "Every bid, every member, every cycle — recorded and visible. No back-room allocations.",
  },
  {
    icon: TrendingDown,
    title: "Lowest bid wins",
    desc: "The member willing to accept the most discount on the pool wins the corpus that month.",
  },
  {
    icon: Users,
    title: "Fair share for everyone",
    desc: "The auction discount is split equally among all non-winning members as a dividend.",
  },
  {
    icon: ShieldCheck,
    title: "Recorded & audited",
    desc: "Auction transcripts are stored, signed, and verifiable by any member at any time.",
  },
];

// Worked example using the VSYK settlement formula (commission 5% of chit value).
const EX = (() => {
  const value = 200000;
  const members = 20;
  const bid = 24000; // winning auction discount
  const commission = value * 0.05; // ₹10,000
  const dividendPool = Math.max(bid - commission, 0); // ₹14,000
  const dividendPerMember = dividendPool / members; // ₹700
  const monthly = value / members; // ₹10,000
  return {
    value,
    members,
    bid,
    commission,
    dividendPool,
    dividendPerMember,
    monthly,
    prize: value - bid,
    net: monthly - dividendPerMember,
  };
})();

export default function AuctionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Auctions"
        title={
          <>
            Fair auctions. <span className="text-gradient">Live every month.</span>
          </>
        }
        description="The heart of every chit cycle. Transparent, fast, member-driven — built so that everyone leaves better off, whether you bid or wait."
      />

      {/* Live auction demo */}
      <section className="relative pb-16">
        <div className="container-x">
          <LiveAuctionDemo />
        </div>
      </section>

      {/* Principles */}
      <section className="relative py-20 sm:py-24">
        <div className="container-x">
          <SectionHeader
            eyebrow="What makes a fair auction"
            title={
              <>
                Four principles. <span className="text-gradient">Non-negotiable.</span>
              </>
            }
            description="A chit auction only works when everyone trusts the process. Here is what we never compromise on."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.07 }}
                className="group rounded-3xl border border-outline-soft bg-white p-6 shadow-brand-sm transition-all hover:-translate-y-1 hover:shadow-brand-lg"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-brand-md">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-base font-bold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Where the bid goes — worked example */}
      <section className="relative py-20 sm:py-24">
        <div className="container-x">
          <SectionHeader
            eyebrow="The math, made simple"
            title={
              <>
                Where every rupee of the bid <span className="text-gradient">goes.</span>
              </>
            }
            description="When a member wins by accepting a discount, that discount is split three ways — and most of it comes back to the members. Here's a real example on a ₹2,00,000 chit with 20 members."
          />

          <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[1.1fr,1fr]">
            {/* Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="relative overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-7 shadow-brand-md sm:p-9"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                Winning bid this cycle
              </p>
              <p className="mt-1 font-display text-4xl font-bold text-ink">
                ₹{EX.bid.toLocaleString("en-IN")}
              </p>

              <div className="mt-7 space-y-4">
                <BreakdownRow
                  icon={Receipt}
                  label="Foreman commission (5%)"
                  sub="VSYK's transparent, fixed fee on the chit value"
                  value={`₹${EX.commission.toLocaleString("en-IN")}`}
                  tone="ink"
                />
                <BreakdownRow
                  icon={Coins}
                  label="Shared as dividend"
                  sub={`Split equally across all ${EX.members} members`}
                  value={`₹${EX.dividendPool.toLocaleString("en-IN")}`}
                  tone="teal"
                />
              </div>

              <div className="mt-7 rounded-2xl border border-brand-500/10 bg-brand-50/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand-800">
                    Dividend per member
                  </span>
                  <span className="font-display text-xl font-bold text-brand-700">
                    ₹{EX.dividendPerMember.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-brand-500/10 pt-3">
                  <span className="text-sm font-semibold text-ink">
                    Your installment this month
                  </span>
                  <span className="font-display text-lg font-bold text-ink">
                    <span className="text-ink-fade line-through decoration-ink-fade/40">
                      ₹{EX.monthly.toLocaleString("en-IN")}
                    </span>{" "}
                    → ₹{EX.net.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Two outcomes */}
            <div className="grid gap-6">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative overflow-hidden rounded-[2rem] bg-brand-gradient-deep p-7 text-white shadow-brand-lg"
              >
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-300/20 blur-3xl" />
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-teal-300 ring-1 ring-white/20">
                  <Trophy className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">If you win early</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                  You take home the lump sum now — the chit value minus your bid — exactly when you
                  need it for a big goal or emergency.
                </p>
                <p className="mt-4 font-display text-3xl font-bold text-teal-300">
                  ₹{EX.prize.toLocaleString("en-IN")}
                </p>
                <p className="text-[12px] text-white/55">paid out to the winner</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-7 shadow-brand-md"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Coins className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">If you wait</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
                  Every cycle you don&apos;t win, you earn a dividend that quietly lowers your cost —
                  rewarding your patience month after month.
                </p>
                <p className="mt-4 font-display text-3xl font-bold text-brand-700">
                  ₹{EX.dividendPerMember.toLocaleString("en-IN")}
                  <span className="text-base font-semibold text-ink-fade"> /month</span>
                </p>
                <p className="text-[12px] text-ink-fade">back in your pocket, this example cycle</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <FAQ />
    </>
  );
}

function LiveAuctionDemo() {
  const POOL = 200000;
  const MIN_BID = 24000;
  const MAX_BID = 60000;
  const [bid, setBid] = useState(MIN_BID);
  const [phase, setPhase] = useState<"open" | "leading" | "won">("open");
  const [timer, setTimer] = useState(45);

  useEffect(() => {
    const interval = setInterval(() => {
      setBid((b) => {
        const next = b + Math.round(Math.random() * 2000) + 1000;
        if (next > MAX_BID) return MIN_BID + 6000;
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTimer((s) => {
        if (s <= 1) {
          if (phase === "open") setPhase("leading");
          else if (phase === "leading") setPhase("won");
          else if (phase === "won") setPhase("open");
          return 45;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const winner = bid;
  const dividendPerMember = Math.round(winner / 20);
  const payout = POOL - winner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="relative overflow-hidden rounded-[2.5rem] border border-outline-soft bg-white p-7 shadow-brand-lg sm:p-10"
    >
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-300/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 -bottom-32 h-96 w-96 rounded-full bg-brand-300/15 blur-3xl" />

      <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr,1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              Live demo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-soft px-3 py-1.5 text-[11px] font-semibold text-ink-fade">
              <Activity className="h-3 w-3" />
              Horizon · 2L · 12 of 20 cycles
            </span>
          </div>
          <h2 className="mt-6 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
            Watch how an auction
            <br />
            <span className="text-gradient">actually plays out.</span>
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-mute">
            This is a simulation of a real chit auction. Members place bids, the lowest bid wins,
            and the discount becomes a dividend for everyone else. Watch the bid update live.
          </p>

          <div className="mt-7 grid grid-cols-3 gap-3 rounded-2xl border border-outline-soft bg-surface-mute/50 p-3">
            <Mini label="Pool" value={formatINRCompact(POOL)} />
            <Mini label="Members" value="20" />
            <Mini label="Phase">
              <AnimatePresence mode="wait">
                <motion.span
                  key={phase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="capitalize"
                >
                  {phase}
                </motion.span>
              </AnimatePresence>
            </Mini>
          </div>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-gradient-deep p-6 text-white shadow-brand-xl sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-teal-300/30 blur-3xl" />
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                <Gavel className="h-3 w-3 text-teal-300" /> Current bid
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
                <Timer className="h-3 w-3 text-teal-300" />
                {String(Math.floor(timer / 60)).padStart(2, "0")}:
                {String(timer % 60).padStart(2, "0")}
              </span>
            </div>

            <div className="relative mt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                Highest discount offered
              </p>
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={bid}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mt-1 font-display text-5xl font-bold tracking-tight"
                >
                  ₹{bid.toLocaleString("en-IN")}
                </motion.p>
              </AnimatePresence>
              <p className="mt-1 text-xs text-white/65">by Member #{(bid % 17) + 1}</p>
            </div>

            <div className="relative mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Payout to winner
                </p>
                <p className="font-display text-xl font-bold text-white">
                  {formatINRCompact(payout)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Each other member earns
                </p>
                <p className="font-display text-xl font-bold text-teal-300">
                  ₹{dividendPerMember.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-teal-300 to-white"
                animate={{ width: `${(timer / 45) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>

          <Link
            href="/contact"
            className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl"
          >
            Talk to an Advisor
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function Mini({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-fade">{label}</p>
      <p className="font-display text-sm font-bold text-ink">{value ?? children}</p>
    </div>
  );
}

function BreakdownRow({
  icon: Icon,
  label,
  sub,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  value: string;
  tone: "ink" | "teal";
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
          tone === "teal" ? "bg-teal-500/12 text-teal-600" : "bg-brand-50 text-brand-700"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-ink">{label}</p>
        <p className="text-[12px] leading-snug text-ink-fade">{sub}</p>
      </div>
      <span className="font-display text-lg font-bold text-ink">{value}</span>
    </div>
  );
}
