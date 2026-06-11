"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Align = "left" | "center";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: Align;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: Props) {
  const alignCls = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={cn("relative z-10 mx-auto flex max-w-3xl flex-col gap-5", alignCls, className)}>
      {eyebrow && (
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="eyebrow"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="heading-display text-display-lg"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-2xl text-base leading-relaxed text-ink-mute sm:text-lg"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
