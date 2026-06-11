"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ShieldCheck,
  Sparkles,
  Compass,
  HeartHandshake,
  Eye,
  Target,
  Award,
  ArrowRight,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Leadership } from "@/components/home/Leadership";

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Integrity above all",
    desc: "Every rupee tracked. Every auction recorded. Every member treated the same — regardless of ticket size.",
  },
  {
    icon: HeartHandshake,
    title: "Community first",
    desc: "Chits work because neighbours trust each other. We protect that trust with banking-grade systems.",
  },
  {
    icon: Eye,
    title: "Radical transparency",
    desc: "From bid amounts to dividend calculations — every number is visible to every member, always.",
  },
  {
    icon: Compass,
    title: "Built to last",
    desc: "30+ years of consistent operations, audited quarterly, with no compromise on member outcomes.",
  },
];

const MILESTONES = [
  { year: "1995", title: "Founded", desc: "VSYK begins in a single office with a single chit group." },
  { year: "2003", title: "10,000 members", desc: "Our first major milestone — a decade of monthly cycles without delay." },
  { year: "2012", title: "Digital records", desc: "Every chit, payment, and auction moves to a digital ledger." },
  { year: "2020", title: "Member app launched", desc: "Real-time tracking, digital receipts, and online auctions." },
  { year: "2025", title: "₹250 Cr+ corpus", desc: "Across schemes, with on-time payouts at 99.8% — and growing." },
];

const PILLARS = [
  { icon: Target, title: "Our Mission", body: "To make disciplined savings accessible, transparent, and dignified for every Indian family — from urban professionals to small business owners." },
  { icon: Sparkles, title: "Our Vision", body: "A future where the chit fund is the most trusted instrument for family wealth-building, powered by technology and led by community." },
  { icon: Award, title: "Our Promise", body: "Three numbers we don't compromise on: 100% transparency, 99.8% on-time payouts, and 0 hidden conditions." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About VSYK"
        title={
          <>
            Three decades of trust.
            <br />
            <span className="text-gradient">Built one cycle at a time.</span>
          </>
        }
        description="VSYK CHITS is a family-led financial services institution helping members turn monthly discipline into life-defining outcomes. Founded in 1995, refined every year since."
        actions={
          <>
            <Link
              href="/schemes"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl"
            >
              See Active Schemes
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-500/20 bg-white px-7 py-4 text-sm font-semibold text-brand-700 shadow-brand-sm transition-all hover:-translate-y-0.5 hover:bg-brand-50"
            >
              Visit Our Office
            </Link>
          </>
        }
      />

      {/* Pillars */}
      <section className="relative pb-16">
        <div className="container-x">
          <div className="grid gap-5 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-3xl border border-outline-soft bg-white p-8 shadow-brand-sm transition-all hover:-translate-y-1 hover:shadow-brand-lg"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-brand-md">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-ink">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-mute">{p.body}</p>
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal-300/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Leadership />

      {/* Values */}
      <section className="relative py-24 sm:py-28 lg:py-32">
        <div className="container-x">
          <SectionHeader
            eyebrow="What we stand for"
            title={
              <>
                Four values. <span className="text-gradient">Zero shortcuts.</span>
              </>
            }
            description="The principles below shape every product decision, every member interaction, and every audit we go through."
          />
          <div className="mt-16 grid gap-5 sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: i * 0.06 }}
                className="group flex gap-5 rounded-3xl border border-outline-soft bg-white p-7 shadow-brand-sm transition-all hover:-translate-y-1 hover:shadow-brand-lg"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <v.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">{v.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-mute">{v.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="relative py-24 sm:py-28 lg:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-brand-50/40 to-transparent" />
        <div className="container-x">
          <SectionHeader
            eyebrow="Our journey"
            title={
              <>
                30 years. <span className="text-gradient">Still just getting started.</span>
              </>
            }
            description="From a single office in 1995 to ₹250 Cr+ in active corpus, every year added something to who we are today."
          />

          <div className="relative mx-auto mt-20 max-w-3xl">
            <div className="absolute left-7 top-2 bottom-2 w-px bg-gradient-to-b from-brand-500 via-teal-500 to-teal-300" />

            {MILESTONES.map((m, i) => (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="relative flex gap-6 pb-10 last:pb-0"
              >
                <div className="relative z-10 grid h-[3.5rem] w-[3.5rem] shrink-0 place-items-center rounded-2xl border-4 border-surface-alt bg-white shadow-brand-md">
                  <span className="grid h-full w-full place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 font-display text-xs font-bold text-white">
                    {m.year}
                  </span>
                </div>
                <div className="flex-1 rounded-2xl border border-outline-soft bg-white p-5 shadow-brand-sm">
                  <h3 className="font-display text-lg font-bold text-ink">{m.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-mute">{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance strip */}
      <section id="compliance" className="relative py-16">
        <div className="container-x">
          <div className="overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-8 shadow-brand-md sm:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <span className="eyebrow">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Compliance & Safety
                </span>
                <h3 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl">
                  Audited quarterly. <span className="text-gradient">Verified independently.</span>
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-mute">
                  We operate under the Chit Funds Act with periodic statutory audits and encrypted
                  member records. Compliance isn&apos;t a certificate on the wall — it&apos;s how we run every day.
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-3 text-sm">
                {["Chit Funds Act", "Quarterly Audit", "Data Privacy", "Statutory Compliance"].map((c) => (
                  <li
                    key={c}
                    className="rounded-2xl border border-brand-500/15 bg-brand-50/50 px-4 py-3 text-center font-semibold text-brand-700"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
