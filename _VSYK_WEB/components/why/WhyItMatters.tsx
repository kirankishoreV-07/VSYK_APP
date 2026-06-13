"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ShieldCheck, PiggyBank, Zap, HandCoins } from "lucide-react";

const POINTS = [
  {
    icon: PiggyBank,
    title: "A savings habit you can't skip",
    desc: "A fixed monthly commitment turns good intentions into consistent action — the single biggest predictor of long-term wealth.",
  },
  {
    icon: Zap,
    title: "Liquidity when life demands it",
    desc: "Unlike locked deposits, you can bid in the monthly auction and unlock a lump sum exactly when an opportunity — or an emergency — arrives.",
  },
  {
    icon: HandCoins,
    title: "Everyone earns, every cycle",
    desc: "The auction discount is shared as a dividend among members who wait — so patience is quietly rewarded, month after month.",
  },
];

export function WhyItMatters() {
  return (
    <section className="relative py-20 sm:py-24 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-radial opacity-30" />
      <div className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr,1.05fr] lg:gap-16">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-xl"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.25rem] border border-white/40 shadow-brand-xl">
              <Image
                src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1000&q=80"
                alt="A family reviewing their household finances together"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 90vw, 520px"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-900/55 via-brand-700/10 to-transparent" />

              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.92 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.45 }}
                className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/85 px-4 py-3 shadow-brand-lg backdrop-blur-xl"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-display text-sm font-bold text-ink">
                    Savings + access, in one instrument
                  </div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-fade">
                    Discipline without rigidity
                  </div>
                </div>
              </motion.div>
            </div>
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -z-10 h-40 w-3/4 -translate-x-1/2 rounded-full bg-teal-500/25 blur-3xl" />
          </motion.div>

          {/* Copy */}
          <div>
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="eyebrow"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Why it matters
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 font-display text-display-lg font-bold leading-[1.1] tracking-tight text-ink"
            >
              A chit fund does what most savings tools{" "}
              <span className="text-gradient">can&apos;t do alone.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 max-w-xl text-base leading-relaxed text-ink-mute sm:text-lg"
            >
              For generations, Indian families have used chit funds to stay disciplined while
              keeping their money within reach. It is both a <strong className="font-semibold text-ink">savings plan</strong> and a{" "}
              <strong className="font-semibold text-ink">flexible credit line</strong> — built on community trust, made transparent by VSYK.
            </motion.p>

            <ul className="mt-8 space-y-4">
              {POINTS.map((p, i) => (
                <motion.li
                  key={p.title}
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.1 }}
                  className="group flex gap-4 rounded-2xl border border-transparent p-3 transition-all duration-300 hover:border-outline-soft hover:bg-white hover:shadow-brand-md"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div className="pt-0.5">
                    <h3 className="font-display text-base font-bold text-ink sm:text-lg">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-mute">{p.desc}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
