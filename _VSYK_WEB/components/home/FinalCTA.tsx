"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="relative py-20 sm:py-24">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="relative overflow-hidden rounded-[2.5rem] border border-outline-soft bg-white p-10 shadow-brand-lg sm:p-14 lg:p-20"
        >
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 -bottom-32 h-96 w-96 rounded-full bg-brand-300/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" />

          <div className="relative mx-auto max-w-3xl text-center">
            <span className="eyebrow">
              <ShieldCheck className="h-3.5 w-3.5" />
              Open to new members
            </span>
            <h2 className="mt-6 font-display text-display-xl font-bold leading-tight text-ink">
              Start the most disciplined
              <br /> <span className="text-gradient">savings habit of your life.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-mute sm:text-lg">
              Browse active chit schemes, talk to an advisor, or download the VSYK app — and join
              50,000+ families who already trust us with their milestones.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/schemes"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all duration-300 hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-brand-xl"
              >
                Browse Chit Schemes
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-500/20 bg-white px-7 py-4 text-sm font-semibold text-brand-700 shadow-brand-sm transition-all duration-300 hover:border-brand-500/40 hover:bg-brand-50 hover:-translate-y-0.5"
              >
                Talk to an Advisor
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
