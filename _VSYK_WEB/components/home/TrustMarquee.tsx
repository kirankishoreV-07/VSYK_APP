"use client";

import { motion } from "framer-motion";

const LOGOS = [
  "Trusted Since 1995",
  "RBI Compliant",
  "₹250 Cr+ Managed",
  "50,000+ Members",
  "ISO 27001 Aligned",
  "Banking-Grade Security",
  "Audited Quarterly",
  "Member-First Charter",
];

export function TrustMarquee() {
  const row = [...LOGOS, ...LOGOS];
  return (
    <section className="relative border-y border-outline-soft bg-white py-8">
      <div className="container-x mb-5 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-fade">
          Trusted across South India
        </p>
        <span className="hidden text-[11px] font-semibold text-ink-fade sm:inline-flex">
          Audited · Insured · Regulated
        </span>
      </div>
      <div className="relative overflow-hidden mask-fade-edges">
        <motion.div
          className="flex w-max items-center gap-12 whitespace-nowrap pl-8"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 40, ease: "linear", repeat: Infinity }}
        >
          {row.map((label, i) => (
            <span
              key={i}
              className="font-display text-base font-bold uppercase tracking-[0.16em] text-ink-fade/70"
            >
              {label}
              <span className="ml-12 inline-block h-1.5 w-1.5 rounded-full bg-outline align-middle" />
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
