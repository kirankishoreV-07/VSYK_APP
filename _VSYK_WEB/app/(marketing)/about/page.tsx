"use client";

import { motion } from "framer-motion";
import Image from "next/image";
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
  Users,
  TrendingUp,
  Lock,
  Headphones,
  CheckCircle2,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
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
    desc: "Three decades of consistent operations, audited quarterly, with no compromise on member outcomes.",
  },
];

const MILESTONES = [
  { year: "1995", title: "Founded", desc: "VSYK begins in a single office with a single chit group." },
  { year: "2003", title: "A growing community", desc: "Our first major milestone — a decade of monthly cycles without delay." },
  { year: "2012", title: "Digital records", desc: "Every chit, payment, and auction moves to a digital ledger." },
  { year: "2020", title: "Trust through every storm", desc: "Through a global pandemic, not a single cycle was missed — payouts continued, on time, for every member." },
  { year: "2025", title: "Crores in active corpus", desc: "Across schemes, with on-time payouts at 99.8% — and growing." },
];

const PILLARS = [
  {
    icon: Target,
    title: "Our Mission",
    body: "To make disciplined savings accessible, transparent, and dignified for every Indian family — from urban professionals to small business owners.",
    img: "https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=900&q=80",
  },
  {
    icon: Sparkles,
    title: "Our Vision",
    body: "A future where the chit fund is the most trusted instrument for family wealth-building, powered by technology and led by community.",
    img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
  },
  {
    icon: Award,
    title: "Our Promise",
    body: "Three things we don't compromise on: complete transparency, on-time payouts, and zero hidden conditions.",
    img: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=900&q=80",
  },
];

const TRUST_STATS = [
  { value: 30, suffix: "+", label: "Years of trust", desc: "Decades of community-led savings" },
  { value: 1000, suffix: "+", label: "Members", desc: "Families across South India" },
  { text: "Crores", label: "Managed", desc: "Across all active schemes" },
  { value: 99.8, suffix: "%", decimals: 1, label: "On-time payouts", desc: "Settlements without delay" },
];

const REASONS = [
  { icon: ShieldCheck, title: "Regulated & secure", desc: "Operated under the Chit Funds Act with quarterly statutory audits and encrypted member records." },
  { icon: Eye, title: "Truly transparent", desc: "Every bid, payment and dividend is recorded and visible to members — no hidden charges, ever." },
  { icon: TrendingUp, title: "Flexible by design", desc: "Save monthly and access a lump sum early through a fair, open auction whenever life needs it." },
  { icon: Lock, title: "Banking-grade systems", desc: "Escrow-grade settlements and a secure member app keep your money and data protected." },
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
              href="/why-chit-funds"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 text-sm font-semibold text-white shadow-premium transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-xl"
            >
              Why Chit Funds?
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

      {/* Company Introduction */}
      <section className="relative pb-20 pt-4">
        <div className="container-x">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,1fr] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-xl"
            >
              <div className="relative aspect-[5/4] overflow-hidden rounded-[2.25rem] border border-white/40 shadow-brand-xl">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1100&q=80"
                  alt="A VSYK advisor guiding a member through their savings plan"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 90vw, 540px"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-900/45 via-transparent to-transparent" />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.92 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute -bottom-6 -right-2 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-brand-lg backdrop-blur-xl sm:right-6"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-display text-base font-bold text-ink">1,000+ families</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-fade">
                    Trust us with their goals
                  </div>
                </div>
              </motion.div>
              <div className="pointer-events-none absolute -bottom-8 left-1/2 -z-10 h-40 w-3/4 -translate-x-1/2 rounded-full bg-teal-500/20 blur-3xl" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
            >
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Who we are
              </span>
              <h2 className="mt-5 font-display text-display-lg font-bold leading-[1.1] tracking-tight text-ink">
                A family business, built on{" "}
                <span className="text-gradient">family trust.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-ink-mute sm:text-lg">
                For three decades, VSYK CHITS has helped families across South India save with
                discipline and reach their milestones with confidence. What began as a single chit
                group has grown into a trusted institution — but our promise hasn&apos;t changed:
                treat every member like family, and keep every rupee accountable.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink-mute">
                Under the leadership of Managing Director <span className="font-bold">MR.R.VENKATESAN</span>, we pair the warmth of a
                community savings circle with the rigour of banking-grade systems and statutory
                compliance.
              </p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {["Family-led since 1995", "Regulated & audited", "Banking-grade security", "Member-first charter"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-500" />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="relative pb-16">
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
              {TRUST_STATS.map((s, i) => (
                <div
                  key={s.label}
                  className={`relative px-2 ${i > 0 ? "lg:border-l lg:border-outline-soft lg:pl-8" : ""}`}
                >
                  <p className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                    <span className="text-gradient">
                      {s.text ? (
                        s.text
                      ) : (
                        <AnimatedCounter to={s.value ?? 0} suffix={s.suffix} decimals={s.decimals} />
                      )}
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

      {/* Pillars — Mission / Vision / Promise */}
      <section className="relative py-16">
        <div className="container-x">
          <SectionHeader
            eyebrow="What drives us"
            title={
              <>
                Mission, vision, <span className="text-gradient">and a promise.</span>
              </>
            }
            description="The three commitments that shape every scheme we run and every member relationship we hold."
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-[1.75rem] shadow-brand-md ring-1 ring-black/5 transition-shadow duration-500 hover:shadow-brand-xl"
              >
                <Image
                  src={p.img}
                  alt={p.title}
                  fill
                  className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                {/* legibility gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/45 to-brand-950/10" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-700/30 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-90" />

                <div className="relative p-7">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-md transition-transform duration-300 group-hover:-translate-y-1">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-bold text-white drop-shadow-sm">
                    {p.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-white/85 drop-shadow-sm">
                    {p.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose VSYK */}
      <section className="relative py-20 sm:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-radial opacity-30" />
        <div className="container-x">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr,1.05fr] lg:gap-16">
            <div className="order-2 lg:order-1">
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Why choose VSYK
              </span>
              <h2 className="mt-5 font-display text-display-lg font-bold leading-[1.1] tracking-tight text-ink">
                Trust you can <span className="text-gradient">verify.</span>
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-mute sm:text-lg">
                We believe trust is earned in the details. Here&apos;s what sets VSYK apart from an
                ordinary savings scheme.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {REASONS.map((r, i) => (
                  <motion.div
                    key={r.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="rounded-2xl border border-outline-soft bg-white p-5 shadow-brand-sm transition-all hover:-translate-y-1 hover:shadow-brand-md"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                      <r.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 font-display text-base font-bold text-ink">{r.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{r.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative order-1 mx-auto w-full max-w-xl lg:order-2"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2.25rem] border border-white/40 shadow-brand-xl">
                <Image
                  src="https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=1000&q=80"
                  alt="A family planning their financial future with confidence"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 90vw, 520px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/55 via-transparent to-transparent" />
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.92 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-brand-900/70 px-4 py-3 shadow-brand-lg backdrop-blur-xl"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  <div className="text-white">
                    <div className="font-display text-base font-bold leading-none">
                      Crores managed
                    </div>
                    <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
                      With zero hidden fees
                    </div>
                  </div>
                </motion.div>
              </div>
              <div className="pointer-events-none absolute -bottom-8 left-1/2 -z-10 h-40 w-3/4 -translate-x-1/2 rounded-full bg-teal-500/25 blur-3xl" />
            </motion.div>
          </div>
        </div>
      </section>

      <Leadership />

      {/* Customer-Centric Approach */}
      <section className="relative py-20 sm:py-24">
        <div className="container-x">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,1fr] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-xl"
            >
              <div className="relative aspect-[5/4] overflow-hidden rounded-[2.25rem] border border-white/40 shadow-brand-xl">
                <Image
                  src="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?auto=format&fit=crop&w=1100&q=80"
                  alt="A VSYK relationship manager welcoming a member"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 90vw, 540px"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-900/45 via-transparent to-transparent" />
              </div>
              <div className="pointer-events-none absolute -bottom-8 left-1/2 -z-10 h-40 w-3/4 -translate-x-1/2 rounded-full bg-brand-400/25 blur-3xl" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
            >
              <span className="eyebrow">
                <Headphones className="h-3.5 w-3.5" />
                Customer-centric
              </span>
              <h2 className="mt-5 font-display text-display-lg font-bold leading-[1.1] tracking-tight text-ink">
                Real people, <span className="text-gradient">real relationships.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-ink-mute sm:text-lg">
                Behind every chit is a dedicated advisor who knows your name and your goals. From
                your first enquiry to your final payout, you have a person to talk to — not a
                call-centre queue.
              </p>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: HeartHandshake, k: "Personal", v: "advisor support" },
                  { icon: ShieldCheck, k: "Honest", v: "no hidden terms" },
                  { icon: Award, k: "Proven", v: "decades of care" },
                ].map((c) => (
                  <div
                    key={c.k}
                    className="rounded-2xl border border-outline-soft bg-white p-5 text-center shadow-brand-sm"
                  >
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                      <c.icon className="h-5 w-5" />
                    </span>
                    <p className="mt-3 font-display text-base font-bold text-ink">{c.k}</p>
                    <p className="text-xs text-ink-fade">{c.v}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="relative py-20 sm:py-24 lg:py-28">
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
      <section className="relative py-20 sm:py-24 lg:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-brand-50/40 to-transparent" />
        <div className="container-x">
          <SectionHeader
            eyebrow="Our journey"
            title={
              <>
                30 years. <span className="text-gradient">Still just getting started.</span>
              </>
            }
            description="From a single office in 1995 to crores in active corpus, every year added something to who we are today."
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
