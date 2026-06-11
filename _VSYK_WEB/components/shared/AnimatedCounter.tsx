"use client";

import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  to: number;
  from?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatThousands?: boolean;
};

export function AnimatedCounter({
  to,
  from = 0,
  duration = 1.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  formatThousands = true,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const count = useMotionValue(from);
  const rounded = useTransform(count, (v) => {
    const fixed = v.toFixed(decimals);
    if (!formatThousands) return fixed;
    const [int, dec] = fixed.split(".");
    const withCommas = new Intl.NumberFormat("en-IN").format(Number(int));
    return dec ? `${withCommas}.${dec}` : withCommas;
  });

  useEffect(() => {
    if (inView) {
      const controls = animate(count, to, {
        duration,
        ease: [0.22, 1, 0.36, 1],
      });
      return controls.stop;
    }
  }, [inView, count, to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
