"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, ShieldCheck, Sparkles, Users, CheckCircle2 } from "lucide-react";
import { ChitGlobe } from "@/components/home/ChitGlobe";

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
                href="/contact"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all duration-300 hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-brand-xl"
              >
                Get Started
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

          {/* Right visual — rotating "chit world" globe with the core benefits of a chit
              fund orbiting around it; each benefit sweeps to the front and reveals itself. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[510px]"
          >
            <ChitGlobe />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
