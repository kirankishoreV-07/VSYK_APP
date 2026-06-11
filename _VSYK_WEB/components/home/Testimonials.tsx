"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Star } from "lucide-react";

const STORIES = [
  {
    name: "Lakshmi R.",
    role: "Teacher · Coimbatore",
    quote:
      "I joined the ₹2 lakh chit for my daughter's college admission. The auction was transparent, and the lump sum reached me three weeks early. VSYK changed how my family plans.",
    initials: "LR",
    tone: "from-brand-500 to-teal-500",
    rating: 5,
  },
  {
    name: "Senthil K.",
    role: "Small business owner",
    quote:
      "Expanding my shop needed quick capital. I bid in the monthly auction and won — no paperwork delays, no hidden conditions. My business grew because the process was simple.",
    initials: "SK",
    tone: "from-teal-500 to-brand-600",
    rating: 5,
  },
  {
    name: "Meera Subramanian",
    role: "Member since 2017",
    quote:
      "Every month, I save without thinking about it. Every cycle, I earn a small dividend even when I don't bid. After three groups, the corpus funded my home down payment.",
    initials: "MS",
    tone: "from-brand-700 to-teal-500",
    rating: 5,
  },
  {
    name: "Arjun Prasad",
    role: "Salaried · Bengaluru",
    quote:
      "I tried fixed deposits and mutual funds. The chit gave me both — disciplined savings and the option to access the corpus when an emergency hit. That flexibility is rare.",
    initials: "AP",
    tone: "from-teal-600 to-brand-500",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 sm:py-28 lg:py-32">
      <div className="container-x">
        <SectionHeader
          eyebrow="Member stories"
          title={
            <>
              Real families. <span className="text-gradient">Real milestones.</span>
            </>
          }
          description="Behind every chit is a goal — a wedding, a college admission, a business expansion. Here are a few of the lives VSYK has helped shape."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {STORIES.map((s, i) => (
            <motion.figure
              key={s.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-3xl border border-outline-soft bg-white p-7 shadow-brand-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-brand-lg sm:p-8"
            >
              <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${s.tone} opacity-10 blur-3xl transition-opacity duration-500 group-hover:opacity-25`} />
              <div className="flex items-center gap-1">
                {Array.from({ length: s.rating }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-5 font-display text-lg font-medium leading-relaxed text-ink sm:text-xl">
                &ldquo;{s.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br ${s.tone} font-display text-sm font-bold text-white shadow-brand-md`}
                >
                  {s.initials}
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-fade">{s.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
