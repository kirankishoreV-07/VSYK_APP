"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  align?: "center" | "left";
};

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  className,
  align = "center",
}: Props) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden pt-36 pb-16 sm:pt-44 sm:pb-20 lg:pt-52 lg:pb-24",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-mesh-hero" />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg" />
      <div className="pointer-events-none absolute -right-32 top-20 h-80 w-80 rounded-full bg-teal-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 -bottom-20 h-80 w-80 rounded-full bg-brand-300/25 blur-3xl" />

      <div className="container-x">
        <div
          className={cn(
            "mx-auto flex max-w-3xl flex-col gap-6",
            align === "center" ? "items-center text-center" : "items-start text-left"
          )}
        >
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="eyebrow"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            {eyebrow}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-display-xl font-bold leading-[1.05] tracking-tight text-ink"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="max-w-2xl text-base leading-relaxed text-ink-mute sm:text-lg"
            >
              {description}
            </motion.p>
          )}
          {actions && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-2 flex flex-wrap items-center justify-center gap-3"
            >
              {actions}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
