"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * BEST & MOST ATTRACTIVE 3D IMMERSIVE VERSION
 * Completely different premium 3D "Aspirations Gallery" experience.
 * - Large elegant proper images as 3D floating poster frames arranged in a beautiful curved cinematic wall (true perspective + depth).
 * - Central luxurious golden 3D "Chit Corpus" stage/pool with visible wealth and live counter.
 * - Rich 3D metallic coins continuously flowing across space into the pool (contribution streams with varied paths and Z depth).
 * - Dramatic 3D payout "events": when a goal is chosen, that poster glides forward in 3D space, receives a spectacular shower of coins flying in beautiful arcs, glows, then returns.
 * - Full mouse-controlled 3D orbital camera + elegant slow auto drift for maximum immersion.
 * - Multiple depth layers, gold volumetric lighting, reflections, subtle floor, and "energy" highlights.
 * - No icons. Pure photography + premium motion. Feels like a high-end cinematic financial visualization.
 * - Highly attractive, emotional, modern and trustworthy.
 */

const GOALS = [
  {
    label: "Education",
    img: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=85",
  },
  {
    label: "Health",
    img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=85",
  },
  {
    label: "Marriage",
    img: "https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=800&q=85",
  },
  {
    label: "Home",
    img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=85",
  },
  {
    label: "Business",
    img: "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=800&q=85",
  },
  {
    label: "Savings",
    img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=85",
  },
];

const C = 50;
const GALLERY_RADIUS = 43; // for the curved 3D poster wall

const BASE_ANGLES = GOALS.map((_, i) => -28 + i * 11.2); // gentle curve for cinematic wall

interface CoinProps {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
  isPayout?: boolean;
  targetZ?: number;
}

function CinematicCoin({ id, fromX, fromY, toX, toY, delay, isPayout = false, targetZ = 0 }: CoinProps) {
  // Beautiful 3D curved flight paths
  const midX = (fromX + toX) / 2 + (isPayout ? (Math.random() - 0.5) * 18 : 0);
  const midY = (fromY + toY) / 2 - (isPayout ? 8 : 14);

  const zStart = isPayout ? 8 : 28;
  const zMid = isPayout ? -6 : 4;
  const zEnd = isPayout ? (targetZ || 18) : 3;

  return (
    <motion.div
      className="absolute left-0 top-0 h-3.5 w-3.5"
      style={{ transformStyle: "preserve-3d" }}
      initial={{
        x: `${fromX}%`,
        y: `${fromY}%`,
        z: zStart,
        scale: isPayout ? 0.85 : 0.6,
        opacity: 0,
        rotateY: isPayout ? 120 : 60,
      }}
      animate={{
        x: [`${fromX}%`, `${midX}%`, `${toX}%`],
        y: [`${fromY}%`, `${midY}%`, `${toY}%`],
        z: [zStart, zMid, zEnd],
        scale: isPayout ? [0.85, 1.1, 1.55, 0] : [0.6, 0.95, 0.45, 0],
        opacity: [0, 1, 1, 0],
        rotateY: isPayout ? [120, 320, 520] : [60, 260, 440],
      }}
      transition={{
        duration: isPayout ? 1.45 : 2.25,
        ease: [0.2, 0.9, 0.25, 1],
        delay,
        times: [0, 0.35, 0.72, 1],
      }}
    >
      {/* Highly detailed attractive 3D coin */}
      <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(138deg, #f8e9b8 6%, #e8b923 28%, #c48c0a 52%, #d4af37 78%, #f8e9b8 95%)",
            boxShadow: "inset 0 2.5px 4px rgba(255,255,255,0.98), inset 0 -4px 6px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.4)",
            transform: "translateZ(2.4px)",
          }}
        />
        <div
          className="absolute inset-[0.6px] rounded-full"
          style={{
            background: "linear-gradient(#b37d0c, #8c5f08)",
            transform: "translateZ(1.2px) rotateX(90deg)",
            boxShadow: "0 0 3px rgba(0,0,0,0.7)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(225deg, #d4af37 12%, #a67c0a 60%, #8c5f08 92%)",
            transform: "translateZ(-2.4px) rotateY(180deg)",
            boxShadow: "inset 0 -2px 3px rgba(255,255,255,0.3)",
          }}
        />
        <div
          className="absolute left-1/3 top-1/4 h-[26%] w-[26%] rounded-full bg-white/55"
          style={{ transform: "translateZ(3.1px)" }}
        />
      </div>
    </motion.div>
  );
}

export function ImmersiveChitPool() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(0);
  const [pooled, setPooled] = useState(2715000);
  const [isHovering, setIsHovering] = useState(false);

  const [coins, setCoins] = useState<any[]>([]);

  // Highly immersive full 3D camera - very responsive and attractive to interact with
  const handleMouseMove = (e: React.MouseEvent) => {
    const el = sceneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    setTilt({
      x: Math.max(-20, Math.min(20, -ny * 16)),
      y: Math.max(-38, Math.min(38, nx * 29)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovering(false);
  };
  const handleMouseEnter = () => setIsHovering(true);

  // Elegant auto drift + user 3D control
  const autoDrift = 12;
  const sceneTransform = `perspective(1080px) rotateX(${tilt.x + 7}deg) rotateY(${tilt.y + autoDrift}deg)`;

  // Cinematic auction cycle - one poster "activates" with 3D movement + coin shower
  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % GOALS.length;

        const base = Date.now();
        // Spectacular 6-coin 3D payout shower targeted at the chosen poster
        const shower = Array.from({ length: 6 }).map((_, k) => ({
          id: base + k,
          fromX: C,
          fromY: 48,
          toX: C + (BASE_ANGLES[next] * 0.92),
          toY: 42 + (next - 2.5) * 1.8,
          delay: 0.02 + k * 0.045,
          isPayout: true,
          targetZ: 24 + (k % 3) * 3,
        }));

        setCoins((c) => [...c.slice(-4), ...shower]);

        setTimeout(() => {
          setCoins((c) => c.filter((coin) => !shower.some((s) => s.id === coin.id)));
        }, 1950);

        return next;
      });
    }, 2900);
    return () => clearInterval(id);
  }, []);

  // Continuous attractive 3D contribution flows from sides into the pool
  useEffect(() => {
    let idCounter = 900;
    const spawnWave = () => {
      const newCoins = GOALS.flatMap((_, i) => {
        const baseAngle = BASE_ANGLES[i];
        return [0, 1].map((k) => ({
          id: idCounter++,
          fromX: 12 + (i % 3) * 4 + k * 3,
          fromY: 68 + (i - 2) * 2.5,
          toX: C,
          toY: 51,
          delay: Math.random() * 0.7 + k * 0.12,
          isPayout: false,
        }));
      });
      setCoins((current) => [...current.slice(-22), ...newCoins]);
    };

    spawnWave();
    const iv = setInterval(spawnWave, 1580);

    const growth = setInterval(() => {
      setPooled((p) => p + Math.floor(1950 + Math.random() * 3400));
    }, 4700);

    return () => {
      clearInterval(iv);
      clearInterval(growth);
    };
  }, []);

  // Cleanup old coins
  useEffect(() => {
    const t = setTimeout(() => setCoins((c) => c.slice(-26)), 3100);
    return () => clearTimeout(t);
  }, [coins.length]);

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* Luxurious volumetric lighting - very attractive atmosphere */}
      <div className="pointer-events-none absolute -inset-28 -z-10 rounded-[160px] bg-[radial-gradient(circle_at_42%_28%,rgba(212,175,55,0.15),transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute -inset-32 -z-10 rounded-[180px] bg-[radial-gradient(circle_at_62%_68%,rgba(16,215,205,0.12),transparent_58%)] blur-[120px]" />

      {/* The 3D Immersive Stage */}
      <div
        ref={sceneRef}
        className="relative aspect-square w-full cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: sceneTransform,
            transformStyle: "preserve-3d",
            transition: isHovering ? "transform 60ms linear" : "transform 580ms cubic-bezier(0.22,1,0.32,1)",
          }}
        >
          {/* 3D Floor with reflection for depth */}
          <div
            className="absolute left-1/2 top-[56%] -translate-x-1/2 rounded-[55%] border border-white/10"
            style={{
              width: "102%",
              height: "52%",
              transform: `rotateX(71deg) translateZ(-32px)`,
              background: "radial-gradient(ellipse at 50% 22%, rgba(212,175,55,0.045), transparent 72%)",
            }}
          />

          {/* === CENTRAL 3D GOLDEN CORPUS STAGE (highly attractive centerpiece) === */}
          <div
            className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ transform: `translateZ(11px)` }}
          >
            <div className="relative h-[126px] w-[126px]">
              {/* Deep powerful base */}
              <div
                className="absolute left-1/2 top-1/2 h-[126px] w-[126px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background: "linear-gradient(185deg, #001A22 5%, #0a2533 82%)",
                  transform: "translateZ(-26px) rotateX(90deg)",
                  boxShadow: "0 20px 70px -15px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(212,175,55,0.3)",
                }}
              />

              {/* Thick glass + gold walls */}
              <div
                className="absolute inset-[2px] rounded-full"
                style={{
                  background: "linear-gradient(95deg, rgba(212,175,55,0.22), rgba(84,250,239,0.1), rgba(212,175,55,0.22))",
                  transform: "translateZ(2px)",
                  boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.15), 0 0 48px rgba(212,175,55,0.45)",
                }}
              />

              {/* Beautiful liquid gold-teal surface */}
              <div
                className="absolute left-1/2 top-1/2 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background: "linear-gradient(142deg, rgba(248,233,184,0.78) 4%, rgba(212,175,55,0.55) 33%, rgba(16,215,205,0.48) 62%, rgba(1,120,158,0.6) 92%)",
                  transform: "translateZ(22px)",
                  boxShadow: "0 0 58px rgba(212,175,55,0.7), inset 0 10px 18px rgba(255,255,255,0.6), inset 0 -12px 20px rgba(1,120,158,0.55)",
                }}
              />

              {/* Visible internal 3D coin wealth stack */}
              <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ transform: "translateZ(27px)" }}>
                <div className="relative h-12 w-12">
                  {[0,1,2,3,4,5].map((k) => (
                    <div
                      key={k}
                      className="absolute left-1/2 top-1/2 rounded-full"
                      style={{
                        width: 12 + k * 5.8,
                        height: 12 + k * 5.8,
                        transform: `translate(-50%, -50%) translateZ(${k * 3.9}px)`,
                        background: "linear-gradient(135deg, #f8e9b8, #d4af37)",
                        boxShadow: "inset 0 1.5px 2.5px #fff, 0 1.5px 5px rgba(0,0,0,0.35)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Prominent live amount */}
              <div className="absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ transform: "translateZ(35px)" }}>
                <div className="text-[8.5px] font-medium tracking-[3.8px] text-[#d4af37]/95">CHIT CORPUS</div>
                <div className="font-display text-[23px] font-semibold tabular-nums tracking-[-1.9px] text-white drop-shadow-2xl">
                  ₹{(pooled / 100000).toFixed(1)}L
                </div>
                <div className="mt-0.5 h-px w-10 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
              </div>
            </div>
          </div>

          {/* === CINEMATIC 3D POSTER WALL - large proper images in curved immersive arrangement === */}
          {GOALS.map((goal, i) => {
            const isActive = active === i;
            const angle = BASE_ANGLES[i];
            const x = C + GALLERY_RADIUS * Math.cos((angle * Math.PI) / 180);
            const y = C + (GALLERY_RADIUS * 0.58) * Math.sin((angle * Math.PI) / 180) + (i - 2.5) * 3.5;

            return (
              <div
                key={i}
                className="absolute z-50"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%) translateZ(${isActive ? 42 : 13}px) rotateY(${-angle * 0.65}deg) rotateX(8deg)`,
                  transition: "transform 620ms cubic-bezier(0.21,1,0.3,1)",
                }}
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1.28 : 1,
                    boxShadow: isActive
                      ? "0 0 0 6px rgba(212,175,55,0.5), 0 40px 95px -14px rgba(212,175,55,0.65), 0 16px 32px -6px rgba(0,0,0,0.3)"
                      : "0 22px 52px -12px rgba(1,120,158,0.45)",
                  }}
                  transition={{ type: "spring", stiffness: 190, damping: 15 }}
                  className="relative overflow-hidden rounded-2xl border"
                  style={{
                    width: "118px",
                    height: "138px",
                    borderColor: isActive ? "#d4af37" : "rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(18px)",
                  }}
                >
                  {/* Proper attractive large image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-[900ms]"
                    style={{
                      backgroundImage: `url(${goal.img})`,
                      transform: isActive ? "scale(1.16)" : "scale(1.03)",
                    }}
                  />

                  {/* Elegant cinematic framing + gradient for labels */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/85" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70" />

                  {/* Thin luxury gold frame detail */}
                  <div className="absolute inset-[4px] rounded-xl border border-white/20" />

                  {/* Clean attractive label, no icons */}
                  <div className="absolute inset-x-0 bottom-0 p-3 text-center">
                    <div className="font-display text-[14px] font-semibold tracking-[-0.4px] text-white drop-shadow-2xl">
                      {goal.label}
                    </div>
                  </div>

                  {isActive && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(212,175,55,0.22),transparent_65%)]" />
                  )}
                </motion.div>

                {/* Powerful 3D spotlight when this goal receives the payout */}
                {isActive && (
                  <div
                    className="absolute -inset-8 rounded-3xl border-[3px] border-[#d4af37]/55"
                    style={{ transform: "translateZ(5px)" }}
                  />
                )}
              </div>
            );
          })}

          {/* 3D contribution coins flying into the pool */}
          {coins.filter((c) => !c.isPayout).map((coin) => (
            <CinematicCoin
              key={coin.id}
              id={coin.id}
              fromX={coin.fromX}
              fromY={coin.fromY}
              toX={coin.toX}
              toY={coin.toY}
              delay={coin.delay}
            />
          ))}

          {/* Spectacular 3D payout coin showers to the active poster */}
          {coins.filter((c) => c.isPayout).map((coin) => (
            <CinematicCoin
              key={coin.id}
              id={coin.id}
              fromX={coin.fromX}
              fromY={coin.fromY}
              toX={coin.toX}
              toY={coin.toY}
              delay={coin.delay}
              isPayout
              targetZ={coin.targetZ}
            />
          ))}

          {/* Beautiful 3D architectural rings for extra immersion and volume */}
          <motion.div
            className="absolute left-1/2 top-1/2 z-20 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{
              borderColor: "rgba(212,175,55,0.18)",
              transform: `translateZ(-14px) rotateX(12deg)`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 46, ease: "linear", repeat: Infinity }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 z-20 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
            style={{
              borderColor: "rgba(84,250,239,0.22)",
              transform: `translateZ(7px) rotateX(6deg)`,
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 62, ease: "linear", repeat: Infinity }}
          />
        </div>
      </div>

      {/* Premium floating context badges */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute -top-2 right-2 hidden items-center gap-2 rounded-3xl border border-white/55 bg-white/90 px-4 py-1.5 shadow-2xl backdrop-blur-2xl sm:flex"
      >
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d4af37]" />
        <span className="text-[11px] font-semibold tracking-[0.4px] text-ink">Live • 23 bidding right now</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95 }}
        className="absolute -bottom-3 left-2 hidden items-center gap-2 rounded-3xl border border-white/55 bg-white/90 px-4 py-1 shadow-2xl backdrop-blur-2xl sm:flex"
      >
        <span className="text-[11px] font-semibold tracking-[0.3px] text-brand-700">Everyone benefits from every auction</span>
      </motion.div>

      <div className="mt-3 text-center text-[10.5px] font-medium tracking-[0.9px] text-ink-mute/75">
        Contributions pool together • Fair auctions decide winners • Real families achieve their goals
      </div>
    </div>
  );
}
