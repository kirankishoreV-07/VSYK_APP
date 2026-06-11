"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { UserPlus, Calendar, Gavel, Trophy, Coins } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: UserPlus,
    title: "Join a Chit Group",
    desc: "Become a member of a trusted community savings pool with a fixed tenure.",
    accent: "from-brand-500 to-teal-500",
    img: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=600&q=80",
  },
  {
    num: "02",
    icon: Calendar,
    title: "Pay Monthly Installments",
    desc: "Contribute a fixed amount every month — building financial discipline.",
    accent: "from-brand-600 to-brand-500",
    img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80",
  },
  {
    num: "03",
    icon: Gavel,
    title: "Bid in Monthly Auction",
    desc: "Members bid for the pooled amount; the highest bidder wins that cycle.",
    accent: "from-teal-500 to-teal-400",
    img: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=600&q=80",
  },
  {
    num: "04",
    icon: Trophy,
    title: "Winner Gets Lump Sum",
    desc: "The prize helps fund education, medical bills, or business needs early.",
    accent: "from-brand-500 to-teal-400",
    img: "https://images.unsplash.com/photo-1579621970795-87facc2f976d?auto=format&fit=crop&w=600&q=80",
  },
  {
    num: "05",
    icon: Coins,
    title: "Everyone Earns Dividends",
    desc: "Non-winners receive a share of the discount — everyone benefits over time.",
    accent: "from-brand-700 to-brand-500",
    img: "https://images.unsplash.com/photo-1604594849809-dfedbc827105?auto=format&fit=crop&w=600&q=80",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const lineWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section className="relative py-24 sm:py-28 lg:py-32 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-brand-50/50 to-transparent" />

      <div className="container-x">
        <SectionHeader
          eyebrow="How it works"
          title={
            <>
              A simple <span className="text-gradient">5-step cycle</span> — every month.
            </>
          }
          description="The chit cycle has powered Indian family finances for generations. We've made it fairer, faster, and transparent — without breaking what already works."
        />

        {/* ===== DESKTOP: HORIZONTAL TIMELINE ===== */}
        <div ref={ref} className="relative mt-24 hidden lg:block">
          {/* The horizontal rail */}
          <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-outline-soft">
            <motion.div
              style={{ width: lineWidth }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 via-teal-500 to-teal-300"
            />
          </div>

          <ol className="relative grid grid-cols-5">
            {STEPS.map((step, i) => {
              const above = i % 2 === 0;
              return (
                <li key={step.num} className="relative flex flex-col items-center">
                  {/* Card ABOVE the rail */}
                  {above && (
                    <StepCard step={step} className="mb-10" delay={i * 0.12} from="bottom" />
                  )}

                  {/* Node on the rail */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ type: "spring", stiffness: 220, damping: 16, delay: i * 0.12 }}
                    className="relative z-10"
                  >
                    <span
                      className={`grid h-16 w-16 place-items-center rounded-2xl border-4 border-surface-alt bg-gradient-to-br ${step.accent} text-white shadow-brand-md`}
                    >
                      <step.icon className="h-7 w-7" />
                    </span>
                    <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-ink text-[10px] font-bold text-white">
                      {step.num}
                    </span>
                  </motion.div>

                  {/* Card BELOW the rail */}
                  {!above && (
                    <StepCard step={step} className="mt-10" delay={i * 0.12} from="top" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* ===== MOBILE / TABLET: vertical stack ===== */}
        <div className="relative mt-14 space-y-6 lg:hidden">
          <div className="absolute left-8 top-4 bottom-4 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-500 via-teal-500 to-teal-300/40" />
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className="relative flex items-center gap-5 pl-0"
            >
              <span
                className={`relative z-10 grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-4 border-surface-alt bg-gradient-to-br ${step.accent} text-white shadow-brand-md`}
              >
                <step.icon className="h-7 w-7" />
              </span>
              <div className="flex flex-1 items-center gap-4 overflow-hidden rounded-2xl border border-outline-soft bg-white p-3 shadow-brand-sm">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <Image src={step.img} alt={step.title} fill className="object-cover" sizes="64px" />
                </div>
                <div>
                  <p className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">
                    Step {step.num}
                  </p>
                  <h3 className="font-display text-base font-bold text-ink">{step.title}</h3>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-mute">{step.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  className = "",
  delay,
  from,
}: {
  step: (typeof STEPS)[number];
  className?: string;
  delay: number;
  from: "top" | "bottom";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: from === "top" ? -24 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: from === "top" ? 3 : -3 }}
      className={`group w-[88%] overflow-hidden rounded-3xl border border-outline-soft bg-white shadow-brand-sm transition-colors duration-500 hover:border-brand-500/40 hover:shadow-brand-lg ${className}`}
    >
      <div className="relative h-28 overflow-hidden">
        <Image
          src={step.img}
          alt={step.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          sizes="220px"
        />
        <div className={`absolute inset-0 bg-gradient-to-t from-brand-900/75 via-brand-900/10 to-transparent`} />
        <span className="absolute bottom-2 left-3 font-display text-xs font-bold uppercase tracking-[0.16em] text-white/90">
          Step {step.num}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-display text-base font-bold text-ink">{step.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{step.desc}</p>
      </div>
    </motion.div>
  );
}
