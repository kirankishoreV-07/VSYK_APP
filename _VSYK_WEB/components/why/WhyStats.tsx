"use client";

import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";

type Stat = {
  value?: number;
  text?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
};

const STATS: Stat[] = [
  { value: 30, suffix: "+", label: "Years of disciplined cycles" },
  { value: 1000, suffix: "+", label: "Families saving with VSYK" },
  { text: "Crores", label: "Corpus pooled & managed" },
  { value: 99.8, suffix: "%", decimals: 1, label: "Auctions settled on time" },
];

export function WhyStats() {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="relative isolate overflow-hidden rounded-[2rem] bg-brand-gradient-deep p-8 text-white shadow-brand-lg sm:p-10 lg:p-12"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-radial opacity-80" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />

          <div className="relative mx-auto mb-9 max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
              Proven over decades
            </span>
            <h2 className="mt-5 font-display text-display-md font-bold leading-tight">
              Numbers built on <span className="text-teal-300">trust, not hype.</span>
            </h2>
          </div>

          <div className="relative grid grid-cols-2 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`relative px-2 text-center lg:text-left ${
                  i > 0 ? "lg:border-l lg:border-white/15 lg:pl-8" : ""
                }`}
              >
                <p className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  {s.text ? (
                    s.text
                  ) : (
                    <AnimatedCounter
                      to={s.value ?? 0}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      decimals={s.decimals}
                    />
                  )}
                </p>
                <p className="mt-2 text-sm font-medium text-white/75">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
