"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  HeartPulse,
  Gem,
  Home,
  Briefcase,
  PiggyBank,
  Coins,
  Sparkles,
} from "lucide-react";

/**
 * Animated "chit ecosystem powering life goals" illustration for the hero.
 * Members pool monthly contributions into a central corpus (coins flow inward),
 * and each cycle a payout spotlight travels out to fund a real life goal —
 * education, health, marriage, home, business, savings.
 * Pure framer-motion + SVG. No extra dependencies. Responsive + lightweight.
 */

const GOALS = [
  { icon: GraduationCap, label: "Education" },
  { icon: HeartPulse, label: "Health" },
  { icon: Gem, label: "Marriage" },
  { icon: Home, label: "Home" },
  { icon: Briefcase, label: "Business" },
  { icon: PiggyBank, label: "Savings" },
];

const C = 50; // center (viewBox %)
const R = 37; // orbit radius (viewBox %)

// Position of each goal node, in viewBox 0–100 coordinates (start at top, clockwise).
const POINTS = GOALS.map((_, i) => {
  const a = ((-90 + (360 / GOALS.length) * i) * Math.PI) / 180;
  return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
});

export function ChitEcosystem() {
  const [active, setActive] = useState(0);

  // Cycle the "this month's payout" spotlight around the goals.
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % GOALS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-teal-300/20 blur-3xl" />

      <div className="relative aspect-square w-full">
        {/* === SVG layer: orbit, flow lines, travelling coins === */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Members pooling monthly contributions to fund life goals — education, health, marriage, home, business and savings"
        >
          <defs>
            <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10D7CD" />
              <stop offset="100%" stopColor="#01789E" />
            </linearGradient>
          </defs>

          {/* Orbit ring */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(1,120,158,0.14)" strokeWidth="0.4" />
          {/* Rotating dashed accent ring */}
          <motion.circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke="rgba(16,215,205,0.5)"
            strokeWidth="0.5"
            strokeDasharray="0.6 4"
            strokeLinecap="round"
            style={{ transformOrigin: "50px 50px" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          />

          {POINTS.map((p, i) => (
            <g key={i}>
              {/* connector */}
              <line
                x1={p.x}
                y1={p.y}
                x2={C}
                y2={C}
                stroke={active === i ? "url(#flow)" : "rgba(1,120,158,0.16)"}
                strokeWidth={active === i ? "0.7" : "0.4"}
              />
              {/* contribution coin flowing IN (goal -> pool) */}
              <motion.circle
                r="1.1"
                fill="url(#flow)"
                initial={false}
                animate={{ cx: [p.x, C], cy: [p.y, C], opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2.4,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: i * 0.32,
                  times: [0, 0.15, 0.85, 1],
                }}
              />
            </g>
          ))}

          {/* payout coin flowing OUT to the active goal (pool -> goal) */}
          <motion.circle
            key={active}
            r="1.6"
            fill="#54FAEF"
            initial={{ cx: C, cy: C, opacity: 0, scale: 1 }}
            animate={{
              cx: [C, POINTS[active].x],
              cy: [C, POINTS[active].y],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 1.4, ease: "easeOut", times: [0, 0.2, 0.8, 1] }}
          />
        </svg>

        {/* === Central pooled-corpus node === */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative grid h-[27%] min-h-[96px] w-[27%] min-w-[96px] place-items-center">
            {/* pulse rings */}
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-teal-400/40" />
            <span className="relative grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-brand-xl ring-4 ring-white/40">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 14, ease: "linear", repeat: Infinity }}
                className="absolute inset-1.5 rounded-full border border-dashed border-white/30"
              />
              <span className="relative flex flex-col items-center leading-none">
                <Coins className="h-5 w-5" />
                <span className="mt-1 font-display text-[10px] font-bold tracking-[0.12em]">
                  CHIT POOL
                </span>
              </span>
            </span>
          </div>
        </motion.div>

        {/* === Goal nodes === */}
        {POINTS.map((p, i) => {
          const Goal = GOALS[i];
          const isActive = active === i;
          return (
            <div
              key={Goal.label}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -5, 0] }}
                transition={{
                  scale: { type: "spring", stiffness: 220, damping: 16, delay: 0.4 + i * 0.08 },
                  opacity: { duration: 0.4, delay: 0.4 + i * 0.08 },
                  y: { duration: 3.2 + i * 0.2, ease: "easeInOut", repeat: Infinity },
                }}
                className="flex flex-col items-center"
              >
                <motion.span
                  animate={{
                    scale: isActive ? 1.18 : 1,
                    boxShadow: isActive
                      ? "0 12px 30px rgba(16,215,205,0.45)"
                      : "0 8px 24px rgba(1,120,158,0.10)",
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className={`grid h-11 w-11 place-items-center rounded-2xl border bg-white sm:h-12 sm:w-12 ${
                    isActive
                      ? "border-teal-400 text-teal-600 ring-2 ring-teal-400/40"
                      : "border-outline-soft text-brand-700"
                  }`}
                >
                  <Goal.icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
                </motion.span>
                <span
                  className={`mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    isActive ? "bg-teal-500/12 text-teal-700" : "text-ink-fade"
                  }`}
                >
                  {Goal.label}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* === Floating premium chips === */}
      <motion.div
        initial={{ opacity: 0, x: -24, y: 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 0.9 }}
        className="absolute -left-2 top-6 z-30 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-3.5 py-3 shadow-brand-lg backdrop-blur-md sm:flex"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/10 text-teal-600">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-fade">
            This month funding
          </p>
          <motion.p
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="font-display text-base font-bold text-ink"
          >
            {GOALS[active].label}
          </motion.p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 24, y: 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 1.05 }}
        className="absolute -right-2 bottom-10 z-30 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-3.5 py-3 shadow-brand-lg backdrop-blur-md sm:flex"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Coins className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-fade">
            Dividend Earned
          </p>
          <p className="font-display text-base font-bold text-ink">+₹18,400</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="absolute -bottom-1 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 shadow-brand-md backdrop-blur-md"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
        </span>
        <span className="text-xs font-semibold text-ink">Auction live now</span>
      </motion.div>
    </div>
  );
}
