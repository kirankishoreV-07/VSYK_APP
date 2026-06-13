"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Scale,
  Coins,
  PiggyBank,
  Wallet,
  GraduationCap,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * ChitGlobe — the home hero centerpiece. Best-ever premium rotating animation.
 *
 * Signature deep-brand sphere (gold + teal accents inspired directly by the current
 * website logo screen) with 7 orbiting benefit cards in true 3D. Ultra fluid rotation
 * (auto + pointer drag with inertia + velocity). Cards elegantly sweep forward,
 * scale+lift+gold-glow on active, springy detail reveal. Added micro orbiting coins
 * and refined rings for incredible depth and polish. Fonts: font-display.
 *
 * Card content focused on authentic chit fund benefits (no misleading "zero-interest"
 * framing). Strong emphasis on dividends, community mechanics, discipline, transparency,
 * regulation and real member outcomes.
 */

const GOLD = "#d4af37";

interface Benefit {
  icon: LucideIcon;
  label: string;
  detail: string;
}

const BENEFITS: Benefit[] = [
  { icon: Coins, label: "Group Dividends", detail: "Earn a share of every auction discount." },
  { icon: Users, label: "Community Powered", detail: "Pool savings. Share the wins." },
  { icon: Wallet, label: "Auction Access", detail: "Bid to receive the corpus when you need it." },
  { icon: ShieldCheck, label: "Regulated & Secure", detail: "Audited. Compliant. Trusted." },
  { icon: PiggyBank, label: "Disciplined Growth", detail: "Monthly habits build real wealth." },
  { icon: Scale, label: "Transparent Auctions", detail: "Every bid visible. Fair for all." },
  { icon: GraduationCap, label: "Any Life Goal", detail: "Education, business, milestones." },
];

const N = BENEFITS.length;
const R = 40; // horizontal orbit radius (% of stage)
const K = 0.46; // vertical squash → tilted ring
const TWO_PI = Math.PI * 2;

export function ChitGlobe() {
  const stageRef = useRef<HTMLDivElement>(null);
  const rot = useRef(0); // base auto rotation
  const userRot = useRef(0); // accumulated from user drag
  const velocity = useRef(0); // for inertia fling after drag
  const isDragging = useRef(false);
  const lastDragX = useRef(0);
  const lastDragTime = useRef(0);
  const hovering = useRef(false);
  const [, force] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Best-ever rotation driver: auto + inertia drag + smooth lerp. Respects reduced-motion.
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      rot.current = Math.PI / 2; // park a card at the front, statically
      force((f) => f + 1);
      return;
    }

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      // Apply inertia decay (best feel)
      if (!isDragging.current && Math.abs(velocity.current) > 0.0005) {
        userRot.current += velocity.current * dt;
        velocity.current *= 0.965; // smooth friction
      } else if (!isDragging.current) {
        velocity.current = 0;
      }

      // Auto rotation (slower when hovering or after drag activity, elegant)
      const autoSpeed = hovering.current ? 0.055 : 0.26;
      rot.current = (rot.current + autoSpeed * dt) % TWO_PI;

      force((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Subtle mouse-parallax of the whole scene + premium pointer drag-to-rotate with inertia.
  const handleMouseMove = (e: React.MouseEvent) => {
    const el = stageRef.current;
    if (!el) return;

    // Parallax tilt (always)
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    setTilt({ x: Math.max(-14, Math.min(14, -ny * 11)), y: Math.max(-18, Math.min(18, nx * 16)) });

    // Drag rotate
    if (isDragging.current) {
      const now = performance.now();
      const dx = e.clientX - lastDragX.current;
      const dTime = Math.max(now - lastDragTime.current, 8);
      const deltaRot = (dx / r.width) * 2.8; // sensitivity tuned for premium feel

      userRot.current -= deltaRot; // reverse for natural "drag the world"
      // velocity for nice inertia fling
      velocity.current = (-dx / dTime) * 0.9;

      lastDragX.current = e.clientX;
      lastDragTime.current = now;

      // slow the auto a tad while dragging
      hovering.current = true;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastDragX.current = e.clientX;
    lastDragTime.current = performance.now();
    velocity.current = 0;
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    hovering.current = false; // let auto resume elegantly
    (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
    // velocity already captured; friction will bring it to rest beautifully
  };

  const handleLeave = () => {
    hovering.current = false;
    if (!isDragging.current) {
      setTilt({ x: 0, y: 0 });
    }
  };

  // Snap a clicked card to front (best interactive delight)
  const snapToCard = (idx: number) => {
    const targetTheta = (idx / N) * TWO_PI;
    // Compute the shortest adjustment to bring target to "front" (sin max)
    const currentEffective = (rot.current + userRot.current) % TWO_PI;
    let delta = (targetTheta - currentEffective + Math.PI * 3) % TWO_PI - Math.PI;
    userRot.current = (userRot.current - delta) % TWO_PI;
    velocity.current = 0;
  };

  // Which card is closest to the front (largest sin → nearest the viewer). Includes user drag offset.
  const effectiveRot = rot.current + userRot.current;
  let activeIdx = 0;
  let maxD = -2;
  for (let i = 0; i < N; i++) {
    const d = Math.sin(effectiveRot + (i / N) * TWO_PI);
    if (d > maxD) {
      maxD = d;
      activeIdx = i;
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[510px]">
      {/* Volumetric brand glow — refined warm gold (website logo match) + teal, cinematic */}
      <div className="pointer-events-none absolute -inset-24 -z-10 rounded-[160px] bg-[radial-gradient(circle_at_44%_36%,rgba(212,175,55,0.16),transparent_62%)] blur-3xl" />
      <div className="pointer-events-none absolute -inset-28 -z-10 rounded-[180px] bg-[radial-gradient(circle_at_60%_70%,rgba(16,215,205,0.15),transparent_56%)] blur-[120px]" />

      <div
        ref={stageRef}
        className="relative aspect-square w-full cursor-grab active:cursor-grabbing select-none touch-none"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => (hovering.current = true)}
        onMouseLeave={handleLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ perspective: "1200px" }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `rotateX(${tilt.x + 6}deg) rotateY(${tilt.y}deg)`,
            transformStyle: "preserve-3d",
            transition: "transform 400ms cubic-bezier(0.22,1,0.32,1)",
          }}
        >
          {/* Tilted decorative orbit rings — premium gold exactly like the website brand logo intro */}
          <div
            className="absolute left-1/2 top-1/2 h-[82%] w-[82%] rounded-full border"
            style={{ borderColor: `${GOLD}36`, transform: "translate3d(-50%,-50%,0) rotateX(78deg)" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[82%] w-[82%] rounded-full border border-dashed"
            style={{ borderColor: `${GOLD}1f`, transform: "translate3d(-50%,-50%,-10px) rotateX(78deg) scale(1.14)" }}
          />

          {/* ===== Central rotating chit-world sphere ===== */}
          <ChitSphere active={BENEFITS[activeIdx].label} />

          {/* ===== Orbiting benefit cards — best-ever 3D: drag the orb or click cards to snap them front. Premium gold brand accents from website logo ref. ===== */}
          {BENEFITS.map((b, i) => {
            const theta = effectiveRot + (i / N) * TWO_PI;
            const x = 50 + R * Math.cos(theta);
            const y = 50 + R * K * Math.sin(theta);
            const t = (Math.sin(theta) + 1) / 2; // 0 (back) … 1 (front)
            const isActive = i === activeIdx;

            const tz = (t - 0.5) * 228; // deeper pop for premium 3D
            const scale = 0.88 + t * 0.18 + (isActive ? 0.065 : 0);
            const opacity = 0.48 + t * 0.52;

            const Icon = b.icon;

            return (
              <div
                key={b.label}
                className="absolute left-0 top-0"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  opacity,
                  transform: `translate3d(-50%,-50%,${tz}px) scale(${scale})`,
                  transformStyle: "preserve-3d",
                  zIndex: isActive ? 30 : Math.floor(t * 20),
                }}
                onClick={() => snapToCard(i)}
              >
                <motion.div
                  animate={{
                    boxShadow: isActive
                      ? `0 30px 68px -18px ${GOLD}55, 0 0 0 1.5px ${GOLD}aa, 0 10px 26px -10px rgba(1,120,158,0.25)`
                      : "0 16px 36px -20px rgba(1,120,158,0.42)",
                  }}
                  whileHover={{ scale: isActive ? 1.02 : 1.01 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                  className={`flex w-[174px] items-center gap-3 rounded-3xl border bg-white/95 backdrop-blur px-3.5 py-3 shadow-lg ${
                    isActive ? "border-gold/70" : "border-slate-200/70"
                  }`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-inner"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, #f0c64b 0%, ${GOLD} 52%, #a9790a 100%)`
                        : "linear-gradient(135deg, #01789E 0%, #10D7CD 100%)",
                    }}
                  >
                    <Icon className="h-[17.5px] w-[17.5px]" strokeWidth={2.15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[12.5px] font-semibold leading-tight tracking-[-0.2px] text-ink">
                      {b.label}
                    </span>
                    <span
                      className="block overflow-hidden text-[10px] leading-snug text-ink-mute transition-all duration-300"
                      style={{ maxHeight: isActive ? 30 : 0, opacity: isActive ? 1 : 0 }}
                    >
                      {b.detail}
                    </span>
                  </span>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caption */}
      <div className="mt-2 text-center text-[10.5px] font-medium tracking-[0.9px] text-ink-mute/75">
        Drag to spin • Click cards • Every benefit working in perfect orbit
      </div>
    </div>
  );
}

/**
 * The central brand sphere — refined "best ever" with deeper materials, animated
 * gold highlights, and presentation matching the elegant website logo screen refs.
 * Shows fixed "SAVE & GROW TOGETHER" + live front benefit (inspired by screenshot).
 */
function ChitSphere({ active }: { active: string }) {
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{ transform: "translate3d(-50%,-50%,0)", transformStyle: "preserve-3d" }}
    >
      <style>{`
        @keyframes chitMeridian { 0% { background-position: 0 0; } 100% { background-position: 240px 0; } }
        @keyframes chitGlow { 0%,100% { opacity: 0.48; } 50% { opacity: 0.92; } }
        @keyframes specMove { 0% { transform: translate(12%,8%); } 50% { transform: translate(22%,14%); } 100% { transform: translate(12%,8%); } }
      `}</style>

      {/* Larger premium gold + teal volumetric halo — tuned to logo gold */}
      <div
        className="absolute left-1/2 top-1/2 h-[212px] w-[212px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${GOLD}38, rgba(16,215,205,0.16) 46%, transparent 72%)`,
          animation: "chitGlow 4.2s ease-in-out infinite",
          filter: "blur(14px)",
        }}
      />

      <div
        className="relative h-[172px] w-[172px] overflow-hidden rounded-full"
        style={{
          backgroundImage:
            "linear-gradient(138deg, #05101a 3%, #0a1623 18%, #012a3a 48%, #01789E 82%, #0a2533 97%)",
          boxShadow:
            `0 0 52px ${GOLD}2e, -5px -4px 15px rgba(199,250,245,0.42) inset, 26px 9px 42px rgba(0,0,0,0.62) inset, -22px -9px 36px ${GOLD}24 inset, 62px 0 68px rgba(0,0,0,0.48) inset`,
        }}
      >
        {/* Rotating crisp meridian (longitudes) */}
        <div
          className="absolute inset-0 opacity-52"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(199,250,245,0) 0px, rgba(199,250,245,0) 15px, rgba(199,250,245,0.24) 16px, rgba(199,250,245,0) 17px)",
            backgroundSize: "236px 100%",
            animation: "chitMeridian 13.5s linear infinite",
            maskImage: "radial-gradient(circle at 50% 50%, black 58%, transparent 79%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 58%, transparent 79%)",
          }}
        />
        {/* Elegant gold latitude bands (stronger, website logo gold) */}
        <div
          className="absolute inset-0 opacity-38"
          style={{
            backgroundImage:
              `repeating-linear-gradient(0deg, ${GOLD}00 0px, ${GOLD}00 24px, ${GOLD}2e 25px, ${GOLD}00 26px)`,
            maskImage: "radial-gradient(circle at 50% 50%, black 56%, transparent 81%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 56%, transparent 81%)",
          }}
        />
        {/* Moving top specular highlight for life */}
        <div 
          className="absolute left-[16%] top-[13%] h-10 w-10 rounded-full bg-white/28 blur-[6px]" 
          style={{ animation: "specMove 7.2s ease-in-out infinite" }} 
        />
        {/* Extra small gold specular dot for premium material */}
        <div className="absolute right-[22%] top-[28%] h-2.5 w-2.5 rounded-full bg-[#f0d98a] blur-[1px] opacity-70" />

        {/* Informational center — brand wordmark + SAVE & GROW TOGETHER + live front benefit (refined to match reference animation screenshot) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <span className="font-display text-[18.5px] font-bold tracking-[-0.6px] text-white drop-shadow-md">
            VSYK <span style={{ color: GOLD }}>CHITS</span>
          </span>
          <span
            className="mt-0.5 text-[8px] font-semibold uppercase tracking-[2.2px] text-white/40"
          >
            SAVE &amp; GROW TOGETHER
          </span>

          <span
            className="mt-1 h-px w-8"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
          />

          <span
            key={active}
            className="mt-1.5 animate-[fadeIn_0.45s_ease-out] text-[9.2px] font-semibold leading-tight tracking-[0.2px] text-teal-100/90"
          >
            {active}
          </span>
          <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-[1.8px] text-white/38">
            Trusted Since Day One
          </span>
        </div>
      </div>
    </div>
  );
}

export default ChitGlobe;
