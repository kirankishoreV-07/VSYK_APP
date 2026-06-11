"use client";

import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";

const STATS = [
  { value: 30, suffix: "+", label: "Years of trust", desc: "Decades of community-led savings" },
  { value: 50000, suffix: "+", label: "Happy members", desc: "Families across South India" },
  { value: 250, suffix: " Cr+", prefix: "₹", label: "Corpus managed", desc: "Across all active schemes" },
  { value: 99.8, suffix: "%", decimals: 1, label: "On-time payouts", desc: "Auction settlements without delay" },
];

export function TrustStats() {
  return (
    <section className="relative isolate -mt-10 sm:-mt-16">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-6 shadow-brand-lg sm:p-8 lg:p-10"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-72 w-72 rounded-full bg-brand-300/15 blur-3xl" />

          <div className="relative grid grid-cols-2 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`relative px-2 ${i > 0 ? "lg:border-l lg:border-outline-soft lg:pl-8" : ""}`}
              >
                <p className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                  <span className="text-gradient">
                    <AnimatedCounter
                      to={s.value}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      decimals={s.decimals}
                    />
                  </span>
                </p>
                <p className="mt-2 font-display text-sm font-bold text-ink">{s.label}</p>
                <p className="mt-0.5 text-xs text-ink-fade sm:text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
