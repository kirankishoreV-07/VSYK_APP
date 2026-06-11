"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  ShieldCheck,
  Gavel,
  Wallet,
  PiggyBank,
  BarChart3,
  ArrowRight,
  Star,
  TrendingUp,
} from "lucide-react";

const FEATURES = [
  {
    icon: PiggyBank,
    title: "Disciplined monthly savings",
    desc: "Fixed installments build a flexible corpus — no market volatility, no guesswork.",
    accent: "from-brand-500 to-teal-500",
  },
  {
    icon: Gavel,
    title: "Transparent auctions",
    desc: "Live, fair, and recorded. Every bid is visible to all members — no hidden allocations.",
    accent: "from-brand-600 to-brand-500",
  },
  {
    icon: Wallet,
    title: "Early access to lump sum",
    desc: "Medical bill, business, or wedding? Bid in the monthly auction and unlock funds early.",
    accent: "from-teal-500 to-teal-400",
  },
  {
    icon: BarChart3,
    title: "Dividends every cycle",
    desc: "Even members who don't bid earn a share of the auction discount — everyone benefits.",
    accent: "from-brand-500 to-teal-400",
  },
  {
    icon: ShieldCheck,
    title: "Banking-grade security",
    desc: "Encrypted records, escrow-grade settlements, and compliance you can verify.",
    accent: "from-brand-700 to-brand-500",
  },
];

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section ref={sectionRef} className="relative py-24 sm:py-28 lg:py-32 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-radial opacity-40" />

      <div className="container-x">
        <SectionHeader
          eyebrow="Why VSYK"
          title={
            <>
              A chit fund, <span className="text-gradient">re-imagined</span> for modern families.
            </>
          }
          description="Every feature we ship answers one question: how do we make your money work harder, with complete clarity at every step?"
        />

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1.05fr,1fr] lg:gap-14">
          {/* === LEFT: Editorial image with floating glass cards === */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-xl"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.25rem] border border-white/40 shadow-brand-xl sm:aspect-[5/5]">
              <Image
                src="https://images.unsplash.com/photo-1609220136736-443140cffec6?auto=format&fit=crop&w=1000&q=80"
                alt="An Indian family planning their finances together"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 90vw, 560px"
              />
              {/* brand wash */}
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-900/55 via-brand-700/10 to-transparent" />

              {/* Floating rating card */}
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.92 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="absolute left-5 top-5 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/85 px-4 py-3 shadow-brand-lg backdrop-blur-xl"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white">
                  <Star className="h-5 w-5 fill-current" />
                </span>
                <div>
                  <div className="font-display text-base font-bold text-ink">Trusted since 1994</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-fade">
                    Members for life
                  </div>
                </div>
              </motion.div>

              {/* Floating growth card */}
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.92 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.65 }}
                className="absolute bottom-5 right-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-brand-900/70 px-4 py-3 shadow-brand-lg backdrop-blur-xl"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div className="text-white">
                  <div className="font-display text-lg font-bold leading-none">₹0 hidden fees</div>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
                    Fully transparent
                  </div>
                </div>
              </motion.div>
            </div>

            {/* glow behind image */}
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -z-10 h-40 w-3/4 -translate-x-1/2 rounded-full bg-teal-500/30 blur-3xl" />
          </motion.div>

          {/* === RIGHT: Connected feature list === */}
          <div className="relative">
            {/* vertical guide line */}
            <div className="absolute left-[27px] top-3 bottom-3 hidden w-px bg-gradient-to-b from-brand-500/30 via-teal-500/30 to-transparent sm:block" />

            <ul className="space-y-3">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.li
                    key={f.title}
                    initial={{ opacity: 0, x: 28 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.55, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="group relative flex items-start gap-4 rounded-2xl border border-transparent p-3 transition-all duration-300 hover:border-outline-soft hover:bg-white hover:shadow-brand-md">
                      <motion.span
                        whileHover={{ scale: 1.08, rotate: -6 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className={`relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${f.accent} text-white shadow-brand-md ring-4 ring-surface-alt`}
                      >
                        <Icon className="h-6 w-6" />
                      </motion.span>
                      <div className="pt-1">
                        <h3 className="font-display text-base font-bold text-ink sm:text-lg">
                          {f.title}
                        </h3>
                        <p className="mt-1 text-[14px] leading-relaxed text-ink-mute">{f.desc}</p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-6 pl-3"
            >
              <a
                href="/how-it-works"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-premium transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl"
              >
                See how the full cycle works
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
