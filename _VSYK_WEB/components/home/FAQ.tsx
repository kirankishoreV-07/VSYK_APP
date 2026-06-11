"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    q: "What exactly is a chit fund?",
    a: "A chit fund is a community savings scheme where a fixed group contributes a set amount each month. The pooled amount is then awarded each cycle to the member who places the lowest bid — and everyone else earns a share of the discount as a dividend.",
  },
  {
    q: "How is VSYK different from a fixed deposit?",
    a: "FDs lock your money in. A chit gives you disciplined savings PLUS the option to access the corpus early when life needs it — through a transparent auction. You also earn dividends each month you don't bid.",
  },
  {
    q: "Is VSYK CHITS regulated and safe?",
    a: "Yes. We operate under the Chit Funds Act, with quarterly audits, banking-grade security on the member app, and complete transparency on every transaction.",
  },
  {
    q: "Can I exit a chit before completion?",
    a: "Chits are designed for the full tenure, but we offer member-friendly options including buy-out, substitution, and transparent settlement. Speak to your advisor for details.",
  },
  {
    q: "How do I track my chit and payments?",
    a: "Every member gets access to the VSYK mobile app — real-time payment status, auction calendar, dividend history, and digital receipts. Always in your pocket.",
  },
  {
    q: "Who is behind VSYK CHITS?",
    a: "VSYK is led by Managing Director Mr. R. Venkatesan, with over 30 years of profound experience in the chit fund and financial services industry. The leadership philosophy is simple: trust is non-negotiable.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="relative py-24 sm:py-28 lg:py-32">
      <div className="container-x">
        <SectionHeader
          eyebrow="Common questions"
          title={
            <>
              Everything you wanted to <span className="text-gradient">ask.</span>
            </>
          }
          description="From beginners to long-time members — here's what people ask us most often. Need more clarity? Talk to an advisor."
        />

        <div className="mx-auto mt-16 max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-white shadow-brand-sm transition-all",
                  isOpen ? "border-brand-500/30 shadow-brand-md" : "border-outline-soft"
                )}
              >
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base font-bold text-ink sm:text-lg">
                    {item.q}
                  </span>
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-300",
                      isOpen
                        ? "rotate-180 border-brand-500 bg-brand-500 text-white"
                        : "border-outline text-ink-fade"
                    )}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink-mute">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
