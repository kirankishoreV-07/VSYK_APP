"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Briefcase, Wallet, Home, Check } from "lucide-react";

const AUDIENCES = [
  {
    icon: Wallet,
    title: "Salaried employees",
    img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
    desc: "Turn a slice of every paycheck into a goal-ready corpus — without locking it away.",
    points: [
      "Auto-debit keeps saving effortless",
      "Tap funds early for a deposit or emergency",
      "Earn dividends while you wait",
    ],
  },
  {
    icon: Briefcase,
    title: "Small business owners",
    img: "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=900&q=80",
    desc: "Build working capital you can call on for inventory, expansion or a sudden opportunity.",
    points: [
      "Quick access without loan paperwork",
      "No collateral pledged",
      "Predictable, transparent costs",
    ],
  },
  {
    icon: Home,
    title: "Families planning ahead",
    img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=900&q=80",
    desc: "Fund education, weddings, healthcare and home goals on a steady, dependable timeline.",
    points: [
      "One corpus for every milestone",
      "Bid when the big day arrives",
      "A savings ritual the whole family trusts",
    ],
  },
];

export function WhoItsFor() {
  return (
    <section className="relative py-20 sm:py-24 lg:py-28">
      <div className="container-x">
        <SectionHeader
          eyebrow="Who it's for"
          title={
            <>
              Built for the way{" "}
              <span className="text-gradient">real people save.</span>
            </>
          }
          description="Whatever your income looks like, a chit fund flexes around your goals — not the other way around."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-outline-soft bg-white shadow-brand-sm transition-shadow duration-500 hover:shadow-brand-lg"
            >
              <div className="relative h-44 overflow-hidden">
                <Image
                  src={a.img}
                  alt={a.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-brand-900/10 to-transparent" />
                <span className="absolute left-5 top-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-white ring-1 ring-white/40 backdrop-blur-md">
                  <a.icon className="h-6 w-6" />
                </span>
                <h3 className="absolute bottom-4 left-5 right-5 font-display text-xl font-bold text-white drop-shadow">
                  {a.title}
                </h3>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <p className="text-[15px] leading-relaxed text-ink-mute">{a.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {a.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-sm text-ink">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-500/12 text-teal-600">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
