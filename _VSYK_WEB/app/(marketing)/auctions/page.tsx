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
  Calendar,
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

const UPCOMING = [
  { scheme: "Sunrise · 1L", date: "Tomorrow", time: "11:00 AM", members: 20, pool: 100000 },
  { scheme: "Horizon · 2L", date: "Mar 18", time: "11:30 AM", members: 20, pool: 200000 },
  { scheme: "Summit · 5L", date: "Mar 22", time: "12:00 PM", members: 25, pool: 500000 },
  { scheme: "Venture · 10L", date: "Mar 28", time: "12:30 PM", members: 30, pool: 1000000 },
];

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

      {/* Upcoming auctions */}
      <section className="relative py-20 sm:py-24">
        <div className="container-x">
          <SectionHeader
            eyebrow="Upcoming"
            title={
              <>
                Auctions <span className="text-gradient">this month.</span>
              </>
            }
            description="A peek at the next few cycles. Members get real-time reminders 24 hours before bidding opens."
          />
          <div className="mt-14 overflow-hidden rounded-3xl border border-outline-soft bg-white shadow-brand-md">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50/60 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                <tr>
                  <th className="py-4 pl-6 pr-4">Scheme</th>
                  <th className="py-4 px-4">Date · Time</th>
                  <th className="py-4 px-4">Members</th>
                  <th className="py-4 px-4">Pool</th>
                  <th className="py-4 pr-6"></th>
                </tr>
              </thead>
              <tbody>
                {UPCOMING.map((a, i) => (
                  <tr
                    key={a.scheme}
                    className="border-t border-outline-soft transition-colors hover:bg-surface-mute/50"
                  >
                    <td className="py-5 pl-6 pr-4 font-display font-bold text-ink">{a.scheme}</td>
                    <td className="py-5 px-4 text-ink-mute">
                      <span className="font-semibold text-ink">{a.date}</span> · {a.time}
                    </td>
                    <td className="py-5 px-4 text-ink-mute">{a.members}</td>
                    <td className="py-5 px-4 font-display font-bold text-brand-700">
                      {formatINRCompact(a.pool)}
                    </td>
                    <td className="py-5 pr-6 text-right">
                      <Link
                        href="/contact"
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-[12px] font-bold text-brand-700 transition-colors hover:bg-brand-100"
                      >
                        <Calendar className="h-3 w-3" /> Remind me
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            href="/schemes"
            className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl"
          >
            Find your scheme
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
