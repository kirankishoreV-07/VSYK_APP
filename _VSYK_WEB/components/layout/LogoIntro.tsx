"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LOGO INTRO — Inspired directly by the VSYK website homepage.
 *
 * - Uses the exact light theme, colors, and typography from the homepage + every marketing page:
 *   - Soft off-white surface (#f8fafc / bg-surface-alt)
 *   - Primary brand teal-navy #01789E + vibrant teal #10D7CD / #54faef accents and gradients
 *   - Ink #0b1c30 for text, ink-mute for secondary
 *   - font-display (Space Grotesk) for the wordmark + headings, Inter for body
 *   - Logo treatment matches components/icons/Logo.tsx exactly (VSYK in ink, CHITS in brand-500)
 *   - Decor: faint grid-bg + mesh-hero, soft teal/brand blur orbs, glassmorphism, rounded-2xl/3xl, subtle shadows
 * - No navy, no gold, no dark cinematic treatment at all.
 * - Rich but light-appropriate "best ever" animation: elegant 3D entry + interactive tilt on the logo group,
 *   breathing micro-motions, subtle rotating brand/teal rings, floating teal accent particles/dots,
 *   soft light sweeps in the homepage gradient language, premium springy exit that reveals the light hero.
 * - Structure and timing echo the homepage hero entry (eyebrow → wordmark → trust line).
 * - Once per session (sessionStorage).
 */

export function LogoIntro() {
  const [visible, setVisible] = useState(true);
  const [isInteractive, setIsInteractive] = useState(false);
  const [introTilt, setIntroTilt] = useState({ x: 0, y: 0 });

  // Brand colors taken straight from the homepage (tailwind + globals.css)
  const BRAND = "#01789E";
  const TEAL = "#10D7CD";
  const TEAL_LIGHT = "#54faef";
  const INK = "#0b1c30";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasSeen = sessionStorage.getItem("vsyk_logo_intro_seen");
    if (hasSeen) {
      setVisible(false);
      return;
    }

    // Interactive tilt kicks in after the logo settles (homepage-like timing)
    const interactiveTimer = setTimeout(() => {
      setIsInteractive(true);
    }, 1100);

    // ~2.95s total: beautiful entry, short elegant hold with mouse interaction, refined exit
    const timer = setTimeout(() => {
      setVisible(false);
      setIsInteractive(false);
      sessionStorage.setItem("vsyk_logo_intro_seen", "true");
    }, 2950);

    return () => {
      clearTimeout(interactiveTimer);
      clearTimeout(timer);
    };
  }, []);

  // Mouse-driven 3D tilt (kept for delight, now in light homepage language)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    setIntroTilt({
      x: Math.max(-13, Math.min(13, -ny * 10)),
      y: Math.max(-20, Math.min(20, nx * 15)),
    });
  };

  const handleMouseLeave = () => {
    if (!isInteractive) return;
    setIntroTilt({ x: 0, y: 0 });
  };

  // Subtle floating accent particles — teal/brand tones from the homepage mesh + icons (no coins/gold)
  const particles = Array.from({ length: 7 }).map((_, i) => ({
    id: i,
    delay: 0.6 + i * 0.07,
    baseX: (i % 4 - 1.5) * 48 + (i > 4 ? 18 : 0),
    baseY: Math.floor(i / 3) * 28 - 12,
    size: i % 2 === 0 ? 3.5 : 2.5,
  }));

  // Soft rotating decorative rings in homepage brand/teal (very low opacity)
  const ringRotation = {
    animate: { rotate: 360 },
    transition: { duration: 22, ease: "linear", repeat: Infinity },
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#f8fafc]"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Homepage hero background treatment (mesh + faint grid + soft orbs) — exact from Hero.tsx + PageHero */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-mesh-hero" />
          <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-40" />
          {/* Soft teal/brand glow orbs matching every homepage and marketing page hero */}
          <div className="pointer-events-none absolute -right-28 top-16 h-80 w-80 rounded-full bg-teal-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-28 bottom-16 h-72 w-72 rounded-full bg-brand-300/25 blur-3xl" />
          {/* Very subtle overall light vignette for focus (keeps it clean like the light surfaces) */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(248,250,252,0)_48%,rgba(248,250,252,0.65)_88%)]" />

          {/* Centered logo experience — styled after the homepage Navbar logo + hero wordmark treatment */}
          <div className="relative flex flex-col items-center perspective-1000">
            {/* Subtle decorative tilted rings — brand/teal from the site (very light, homepage glass aesthetic) */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                width: "238px",
                height: "238px",
                transformStyle: "preserve-3d",
              }}
              animate={{
                rotateX: 14 + introTilt.x * 0.3,
                rotateY: introTilt.y * 0.5,
              }}
              transition={{ type: "spring", stiffness: 78, damping: 18 }}
            >
              <motion.div
                className="absolute inset-0 rounded-full border"
                style={{
                  borderColor: `${BRAND}22`,
                  transform: "translateZ(-32px) rotateX(64deg)",
                }}
                {...ringRotation}
              />
              <motion.div
                className="absolute inset-0 rounded-full border border-dashed"
                style={{
                  borderColor: `${TEAL}18`,
                  transform: "translateZ(-13px) rotateX(58deg) scale(1.09)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 26, ease: "linear", repeat: Infinity }}
              />
            </motion.div>

            {/* Main logo group — 3D entry + interactive tilt + breathing (homepage premium feel) */}
            <motion.div
              className="relative"
              style={{ transformStyle: "preserve-3d" }}
              animate={{
                rotateX: introTilt.x,
                rotateY: introTilt.y,
              }}
              transition={{ type: "spring", stiffness: 82, damping: 16 }}
            >
              <motion.div
                className="relative"
                initial={{
                  scale: 0.5,
                  opacity: 0,
                  y: 64,
                  rotateX: 28,
                  rotateY: -16,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  y: 0,
                  rotateX: 0,
                  rotateY: 0,
                }}
                transition={{
                  duration: 1.1,
                  ease: [0.19, 0.94, 0.25, 1],
                  delay: 0.05,
                }}
              >
                {/* Large logo icon — same as Navbar but hero sized, with site shadow style */}
                <motion.img
                  src="/images/logo.png"
                  alt="VSYK"
                  className="h-28 w-auto sm:h-32 drop-shadow-[0_18px_42px_rgba(1,120,158,0.18)]"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{
                    // Elegant micro life during interactive hold (homepage-appropriate, not dramatic)
                    rotateY: isInteractive ? [0, 5, -3.2, 0] : [0, 3.5, -1.8, 0],
                    rotateX: isInteractive ? [0, -2.2, 1.5, 0] : [0, -1, 0.7, 0],
                    scale: isInteractive ? [1, 1.003, 1] : 1,
                  }}
                  transition={{
                    duration: isInteractive ? 3.4 : 2.2,
                    ease: "easeInOut",
                    delay: 1.05,
                    repeat: isInteractive ? Infinity : 0,
                  }}
                />

                {/* Soft brand/teal highlight ring around icon (light theme version of premium framing) */}
                <motion.div
                  className="pointer-events-none absolute -inset-4 rounded-[26px] border"
                  style={{
                    borderColor: `${BRAND}1f`,
                    transform: "translateZ(5px)",
                  }}
                  animate={{
                    scale: [0.96, 1.035, 0.96],
                    opacity: [0.18, 0.42, 0.18],
                  }}
                  transition={{
                    duration: 2.6,
                    ease: "easeInOut",
                    delay: 0.82,
                    repeat: 0,
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Homepage-accurate wordmark: VSYK (ink) + CHITS (brand-500 teal) + small tag exactly like Logo.tsx + hero typography */}
            <motion.div
              className="mt-4 flex flex-col items-center"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ opacity: 0, y: 16, rotateX: 8 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.72, delay: 0.82, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-baseline gap-1.5 font-display text-[38px] sm:text-[44px] font-semibold tracking-[-1.7px] text-ink">
                <span>VSYK</span>
                <span style={{ color: BRAND }}>CHITS</span>
              </div>
              <div className="mt-px text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-mute/80">
                Trusted Since Day One
              </div>

              {/* Small homepage-style emphasis line using the site's signature text-gradient */}
              <div className="mt-2 text-[11px] font-medium tracking-[0.2px]">
                Savings that <span className="text-gradient">grow with you</span>
              </div>
            </motion.div>
          </div>

          {/* Homepage teal/brand accent particles (light, elegant, floating — inspired by icon gradients and mesh orbs) */}
          {particles.map((p, idx) => (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `calc(50% + ${p.baseX}px)`,
                top: `calc(42% + ${p.baseY}px)`,
                width: p.size,
                height: p.size,
                background: idx % 2 === 0 ? TEAL : BRAND,
                opacity: 0.65,
                transformStyle: "preserve-3d",
              }}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{
                opacity: [0, 0.7, 0.55, 0],
                scale: [0.2, 1.05, 0.7],
                y: [0, -14, -26],
                x: [0, (idx % 2 - 0.5) * 6, 0],
              }}
              transition={{
                duration: 2.05,
                delay: p.delay,
                ease: [0.21, 0.9, 0.28, 1],
                repeat: 0,
              }}
            />
          ))}

          {/* Bottom trust line — understated and matching the homepage's quiet confidence */}
          <motion.div
            className="absolute bottom-16 text-center text-[9.5px] tracking-[2.1px] text-ink-mute/55"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 0.75 }}
            transition={{ delay: 1.65, duration: 0.5 }}
          >
            POWERING REAL LIVES THROUGH TRUSTED SAVINGS
          </motion.div>

          {/* Soft light sweep using the homepage text-gradient direction (brand → teal → cyan) */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(118deg, transparent, ${BRAND}0a, ${TEAL}0c, transparent)`,
            }}
            initial={{ backgroundPosition: "-260% 0" }}
            animate={{ backgroundPosition: "260% 0" }}
            transition={{ duration: 2.4, delay: 0.6, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
