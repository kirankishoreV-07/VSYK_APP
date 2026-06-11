"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  UserPlus,
  Calendar,
  Gavel,
  Trophy,
  Coins,
  ArrowRight,
  FileCheck,
  Smartphone,
  Receipt,
  PiggyBank,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FAQ } from "@/components/home/FAQ";

const STEPS = [
  {
    icon: UserPlus,
    title: "1 · Choose & Join",
    desc: "Pick a chit value, tenure, and start month. Complete a quick KYC and you're a member.",
    detail: "Most members complete this in under 15 minutes — bring your PAN, Aadhaar, and a bank reference.",
  },
  {
    icon: Calendar,
    title: "2 · Pay Monthly",
    desc: "A fixed amount goes into the chit pool every month — by UPI, NEFT, or auto-debit.",
    detail: "Get a digital receipt and SMS confirmation in seconds. Track everything in the VSYK app.",
  },
  {
    icon: Gavel,
    title: "3 · Bid in Auction",
    desc: "Each month, members can bid for the pool. The lowest bidder wins the lump sum that cycle.",
    detail: "Auctions are conducted live in-app or on-site. Every bid is logged and visible to all members.",
  },
  {
    icon: Trophy,
    title: "4 · Get Your Corpus",
    desc: "The winner receives the chit value (minus their bid). Funds settle to your bank within 48 hours.",
    detail: "Use it for tuition, surgery, business — anything. No restrictions, no usage proofs needed.",
  },
  {
    icon: Coins,
    title: "5 · Earn Dividends",
    desc: "Even if you don't bid, you receive a share of the discount as a dividend each cycle.",
    detail: "The non-winning members collectively split the bid discount — that's your compounded reward for patience.",
  },
];

const REQUIREMENTS = [
  { icon: FileCheck, label: "PAN & Aadhaar", desc: "For KYC compliance" },
  { icon: Smartphone, label: "Active mobile number", desc: "For OTP and app access" },
  { icon: Receipt, label: "Bank account", desc: "For installments & payouts" },
  { icon: PiggyBank, label: "Monthly capacity", desc: "Pick what fits your budget" },
];

const PAYMENT_OPTIONS = [
  { name: "UPI", desc: "Instant, zero charge — for monthly installments" },
  { name: "Auto-debit", desc: "Set once. Forget. Never miss a cycle." },
  { name: "Net banking", desc: "Direct from any major bank in India" },
  { name: "Cash at office", desc: "Visit our office for in-person payment" },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title={
          <>
            The chit cycle, <span className="text-gradient">end to end.</span>
          </>
        }
        description="A clear, narrated walkthrough of every step — from joining your first chit to receiving the corpus and continuing to earn dividends."
      />

      {/* Timeline */}
      <section className="relative pb-20">
        <div className="container-x">
          <div className="relative mx-auto max-w-3xl">
            <div className="absolute left-7 top-2 bottom-2 w-px bg-gradient-to-b from-brand-500 via-teal-500 to-teal-300" />
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="relative flex gap-6 pb-10 last:pb-0"
              >
                <div className="relative z-10 grid h-[3.5rem] w-[3.5rem] shrink-0 place-items-center rounded-2xl border-4 border-surface-alt bg-white shadow-brand-md">
                  <span className="grid h-full w-full place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white">
                    <s.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex-1 rounded-3xl border border-outline-soft bg-white p-6 shadow-brand-sm">
                  <h3 className="font-display text-xl font-bold text-ink">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-mute">{s.desc}</p>
                  <p className="mt-3 rounded-2xl border border-brand-500/10 bg-brand-50/50 p-3 text-[13px] leading-relaxed text-brand-800">
                    {s.detail}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="relative py-20 sm:py-24">
        <div className="container-x">
          <SectionHeader
            eyebrow="Before you join"
            title={
              <>
                Get ready in <span className="text-gradient">15 minutes.</span>
              </>
            }
            description="Have these handy and you can be a member by the end of your tea break."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REQUIREMENTS.map((r, i) => (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="rounded-3xl border border-outline-soft bg-white p-6 shadow-brand-sm transition-all hover:-translate-y-1 hover:shadow-brand-md"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <r.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-ink">{r.label}</h3>
                <p className="mt-1 text-sm text-ink-mute">{r.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Payments */}
      <section id="payments" className="relative py-20 sm:py-24">
        <div className="container-x">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr,1fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="relative overflow-hidden rounded-[2rem] bg-brand-gradient-deep p-8 text-white shadow-brand-lg sm:p-10"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-300/25 blur-3xl" />
              <span className="eyebrow border-white/20 bg-white/10 text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                Pay any way
              </span>
              <h3 className="mt-5 font-display text-3xl font-bold leading-tight">
                Four payment options.
                <br />
                <span className="text-teal-300">Zero processing charges.</span>
              </h3>
              <ul className="mt-7 space-y-3">
                {PAYMENT_OPTIONS.map((p) => (
                  <li
                    key={p.name}
                    className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-md"
                  >
                    <p className="font-display text-sm font-bold">{p.name}</p>
                    <p className="mt-0.5 text-xs text-white/70">{p.desc}</p>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Auto-debit recommended
              </span>
              <h3 className="mt-5 font-display text-display-md font-bold leading-tight text-ink">
                Set it once.
                <br />
                <span className="text-gradient">Never miss a cycle.</span>
              </h3>
              <p className="mt-4 text-base leading-relaxed text-ink-mute">
                Members who enable auto-debit see the most disciplined savings outcomes — and earn
                a small loyalty dividend at the end of the chit cycle. We support every major bank.
              </p>
              <Link
                href="/contact"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl"
              >
                Talk to an Advisor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Dividends */}
      <section id="dividends" className="relative py-20 sm:py-24">
        <div className="container-x">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <span className="eyebrow">
                <Coins className="h-3.5 w-3.5" />
                Dividends explained
              </span>
              <h3 className="mt-5 font-display text-display-md font-bold leading-tight text-ink">
                Patience that <span className="text-gradient">earns interest.</span>
              </h3>
              <p className="mt-4 text-base leading-relaxed text-ink-mute">
                When the auction winner accepts a discounted lump sum, the discount is divided
                equally among all non-winning members and added to their next installment.
              </p>
              <p className="mt-3 text-base leading-relaxed text-ink-mute">
                Over a 20-month chit, the cumulative dividend can meaningfully offset your monthly
                contribution — making the effective rate of saving very competitive.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative overflow-hidden rounded-[2rem] border border-outline-soft bg-white p-8 shadow-brand-md"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-500 to-teal-300" />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-fade">
                Example · Horizon 2L
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-ink">
                Monthly: ₹10,000
              </p>
              <p className="mt-5 grid grid-cols-2 gap-2 text-sm">
                <span className="rounded-2xl bg-surface-mute p-3 text-ink-fade">Auction discount</span>
                <span className="rounded-2xl bg-brand-50 p-3 font-bold text-brand-700">₹24,000</span>
                <span className="rounded-2xl bg-surface-mute p-3 text-ink-fade">Members</span>
                <span className="rounded-2xl bg-brand-50 p-3 font-bold text-brand-700">20</span>
                <span className="rounded-2xl bg-surface-mute p-3 text-ink-fade">Dividend / member</span>
                <span className="rounded-2xl bg-gradient-to-r from-brand-500 to-teal-500 p-3 font-bold text-white">
                  ₹1,200
                </span>
              </p>
              <p className="mt-5 text-[12px] text-ink-fade">
                Illustrative example. Actual dividends depend on the winning bid each cycle.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <FAQ />
    </>
  );
}
