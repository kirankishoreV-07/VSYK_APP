"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  CalendarCheck,
  Unlock,
  Coins,
  Eye,
  ShieldCheck,
  Users,
} from "lucide-react";

const BENEFITS = [
  {
    icon: CalendarCheck,
    title: "Forced discipline",
    desc: "A fixed monthly installment removes the temptation to skip — your corpus grows on autopilot.",
    accent: "from-brand-500 to-teal-500",
  },
  {
    icon: Unlock,
    title: "Early lump-sum access",
    desc: "Bid in the monthly auction to unlock the pooled amount well before a fixed deposit would mature.",
    accent: "from-teal-500 to-teal-400",
  },
  {
    icon: Coins,
    title: "Dividends for patience",
    desc: "Don't need the money yet? You still earn a share of the auction discount every single cycle.",
    accent: "from-brand-600 to-brand-500",
  },
  {
    icon: Eye,
    title: "Total transparency",
    desc: "Every bid, payment and dividend is recorded and visible — no hidden charges, no surprises.",
    accent: "from-brand-500 to-teal-400",
  },
  {
    icon: ShieldCheck,
    title: "No market volatility",
    desc: "Your outcome doesn't swing with the stock market. Contributions and payouts stay predictable.",
    accent: "from-brand-700 to-brand-500",
  },
  {
    icon: Users,
    title: "Community-backed trust",
    desc: "A regulated group of committed members, run on banking-grade systems and quarterly audits.",
    accent: "from-teal-600 to-brand-500",
  },
];

export function Benefits() {
  return (
    <section className="relative py-20 sm:py-24 lg:py-28">
      <div className="container-x">
        <SectionHeader
          eyebrow="The advantage"
          title={
            <>
              Benefits a savings account{" "}
              <span className="text-gradient">simply can&apos;t match.</span>
            </>
          }
          description="A chit fund blends the discipline of a recurring deposit with the flexibility of credit — and shares the upside with every member."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="group relative overflow-hidden rounded-3xl border border-outline-soft bg-white p-7 shadow-brand-sm transition-shadow duration-500 hover:shadow-brand-lg"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal-300/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
              <span
                className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${b.accent} text-white shadow-brand-md`}
              >
                <b.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-xl font-bold text-ink">{b.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ink-mute">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
