"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  IndianRupee,
  CheckCircle2,
} from "lucide-react";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.4]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden pt-32 pb-20 sm:pt-36 lg:pt-44 lg:pb-28">
      {/* Background mesh */}
      <motion.div
        style={{ y: yBg, opacity }}
        className="pointer-events-none absolute inset-0 -z-10 bg-mesh-hero"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg" />
      <div className="pointer-events-none absolute -right-32 top-20 h-80 w-80 rounded-full bg-teal-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 top-72 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl" />

      <div className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr,1fr]">
          {/* Left copy */}
          <div className="relative z-10">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="eyebrow"
            >
              <Sparkles className="h-3 w-3" />
              Your Trusted Financial Partner · Banking-Grade Security
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-5 font-display text-display-2xl font-bold leading-[1.04] tracking-tight text-ink"
            >
              Savings that{" "}
              <span className="text-gradient">grow with you</span>
              <br className="hidden sm:block" /> for life&apos;s biggest moments.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-ink-mute sm:text-lg"
            >
              VSYK CHITS turns disciplined monthly contributions into a flexible corpus —
              funding education, healthcare, business and major milestones. Without market
              volatility. With complete transparency.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/schemes"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all duration-300 hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-brand-xl"
              >
                Explore Chit Schemes
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-500/15 bg-white px-7 py-4 text-sm font-semibold text-brand-700 shadow-brand-sm transition-all duration-300 hover:border-brand-500/35 hover:bg-brand-50 hover:-translate-y-0.5"
              >
                How a Chit Works
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-ink-mute"
            >
              {[
                { icon: ShieldCheck, label: "Regulated & secure" },
                { icon: CheckCircle2, label: "Transparent auctions" },
                { icon: Users, label: "30+ years of trust" },
              ].map((it) => (
                <span key={it.label} className="inline-flex items-center gap-2">
                  <it.icon className="h-4 w-4 text-teal-500" />
                  <span className="font-medium">{it.label}</span>
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right visual — phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[440px] perspective-1000"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative">
      {/* Floating callouts */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute -left-2 top-24 z-20 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-3.5 py-3 shadow-brand-lg backdrop-blur-md sm:-left-8"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/10 text-teal-600">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-fade">
            Dividend Earned
          </p>
          <p className="font-display text-base font-bold text-ink">+₹18,400</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="absolute -right-2 top-1/2 z-20 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-3.5 py-3 shadow-brand-lg backdrop-blur-md sm:-right-8"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <IndianRupee className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-fade">
            Active Chit
          </p>
          <p className="font-display text-base font-bold text-ink">₹5,00,000</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.0 }}
        className="absolute -bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 shadow-brand-md backdrop-blur-md"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
        </span>
        <span className="text-xs font-semibold text-ink">Auction live now</span>
      </motion.div>

      {/* Phone frame */}
      <div className="relative mx-auto aspect-[9/19] w-[280px] rounded-[2.5rem] border border-ink/10 bg-ink p-[5px] shadow-brand-xl sm:w-[320px]">
        <div className="relative h-full w-full overflow-hidden rounded-[2.2rem] bg-gradient-to-b from-brand-500 to-teal-500">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 text-[10px] font-semibold text-white/80">
            <span>9:41</span>
            <span className="h-3 w-12 rounded-full bg-white/30" />
            <span>●●●</span>
          </div>

          {/* Brand header */}
          <div className="px-5 pb-3 pt-2 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              Good morning
            </p>
            <p className="font-display text-lg font-bold">Welcome back</p>
          </div>

          {/* Card stack */}
          <div className="mx-3 rounded-2xl bg-white/95 p-3 shadow-brand-md backdrop-blur">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold uppercase tracking-wider text-ink-fade">
                Total Saved
              </span>
              <span className="rounded-full bg-teal-500/10 px-2 py-0.5 font-bold text-teal-700">
                +12%
              </span>
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-ink">₹2,84,000</p>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-mute">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-500 to-teal-500" />
            </div>
            <p className="mt-1.5 text-[10px] text-ink-fade">8 of 12 months</p>
          </div>

          {/* Mini cards */}
          <div className="mx-3 mt-3 grid grid-cols-2 gap-2.5">
            {[
              { label: "Chits", value: "3" },
              { label: "Dividends", value: "₹46K" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/90 p-2.5 shadow-soft">
                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-fade">
                  {s.label}
                </p>
                <p className="mt-0.5 font-display text-base font-bold text-ink">{s.value}</p>
              </div>
            ))}
          </div>

          {/* List row */}
          <div className="mx-3 mt-3 rounded-2xl bg-white/95 p-3 shadow-soft">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-fade">
              Next Auction
            </p>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-ink">Sunshine Series A</p>
                <p className="text-[10px] text-ink-fade">Tomorrow · 11:00 AM</p>
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700">
                Join
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Glow */}
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-teal-300/20 blur-3xl" />
    </div>
  );
}
