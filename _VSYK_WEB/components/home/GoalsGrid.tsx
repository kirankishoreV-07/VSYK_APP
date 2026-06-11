"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  GraduationCap,
  HeartPulse,
  Briefcase,
  HomeIcon,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

const GOALS = [
  {
    icon: GraduationCap,
    title: "Education",
    desc: "School fees, college admissions, study abroad — fund every chapter of learning.",
    img: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=900&q=80",
    span: "col-span-2 row-span-2",
    featured: true,
  },
  {
    icon: HeartPulse,
    title: "Healthcare",
    desc: "Surgeries & long-term care, without touching emergency funds.",
    img: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=700&q=80",
    span: "col-span-1 row-span-1",
  },
  {
    icon: Briefcase,
    title: "Business",
    desc: "Working capital, expansion, inventory — power your next move.",
    img: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=700&q=80",
    span: "col-span-1 row-span-1",
  },
  {
    icon: AlertTriangle,
    title: "Emergencies",
    desc: "Bid early when life turns. Get the lump sum exactly when you need it.",
    img: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
    span: "col-span-2 row-span-1",
  },
  {
    icon: HomeIcon,
    title: "Home & Marriage",
    desc: "Property down payments, renovations & weddings — every milestone covered.",
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
    span: "col-span-2 row-span-1",
  },
  {
    icon: Sparkles,
    title: "Aspirations",
    desc: "Travel, vehicles, festivals. Build the corpus, fund the dream.",
    img: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=80",
    span: "col-span-2 row-span-1",
  },
];

export function GoalsGrid() {
  return (
    <section className="relative py-24 sm:py-28 lg:py-32 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-50" />

      <div className="container-x">
        <SectionHeader
          eyebrow="Built for every milestone"
          title={
            <>
              One corpus. <span className="text-gradient">Infinite possibilities.</span>
            </>
          }
          description="A chit fund isn't tied to a single goal. The same disciplined savings can power every priority in your family's life."
        />

        {/* Image-driven bento mosaic — fills 4×3 grid with no gaps */}
        <div className="mt-16 grid auto-rows-[185px] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {GOALS.map((g, i) => (
            <motion.div
              key={g.title}
              initial={{ opacity: 0, y: 26, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className={`group relative flex flex-col justify-end overflow-hidden rounded-[1.75rem] shadow-brand-md ring-1 ring-black/5 transition-shadow duration-500 hover:shadow-brand-xl ${g.span}`}
            >
              {/* Photo */}
              <Image
                src={g.img}
                alt={g.title}
                fill
                className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                sizes="(max-width: 1024px) 50vw, 33vw"
              />

              {/* Legible gradient — dark only at the bottom so photo stays visible */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-950/25 to-brand-950/5" />
              {/* brand tint that lifts on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-700/30 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-90" />

              {/* Number tag */}
              <span className="absolute right-5 top-4 font-display text-xs font-bold tracking-[0.18em] text-white/70 drop-shadow">
                0{i + 1}
              </span>

              {/* Content */}
              <div className="relative p-5 sm:p-6">
                <span
                  className={`inline-flex items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/40 backdrop-blur-md transition-transform duration-300 group-hover:-translate-y-1 ${
                    g.featured ? "h-14 w-14" : "h-11 w-11"
                  }`}
                >
                  <g.icon className={g.featured ? "h-7 w-7" : "h-5 w-5"} />
                </span>
                <h3
                  className={`mt-3 font-display font-bold text-white drop-shadow-sm ${
                    g.featured ? "text-2xl sm:text-3xl" : "text-lg"
                  }`}
                >
                  {g.title}
                </h3>
                <p
                  className={`mt-1.5 leading-relaxed text-white/85 drop-shadow-sm ${
                    g.featured ? "max-w-sm text-[15px]" : "text-[13px]"
                  }`}
                >
                  {g.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
