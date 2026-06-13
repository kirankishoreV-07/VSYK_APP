import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2.5rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1200px",
        "2xl": "1320px",
      },
    },
    extend: {
      colors: {
        // VSYK Brand — extracted from mobile app (lib/constants.ts)
        brand: {
          50: "#EAF8FC",
          100: "#C9ECF4",
          200: "#9FDDEB",
          300: "#5FC0D9",
          400: "#2A9FC1",
          500: "#01789E", // PRIMARY — Deep Teal-Navy
          600: "#016A8C",
          700: "#015872",
          800: "#01445A",
          900: "#01303F",
          950: "#001A22",
        },
        teal: {
          50: "#E8FFFD",
          100: "#C7FAF5",
          200: "#9FF1E9",
          300: "#54FAEF", // light cyan glow
          400: "#2BEEDE",
          500: "#10D7CD", // SECONDARY — Vibrant Teal
          600: "#0CB5AB",
          700: "#0A8E86",
          800: "#076661",
          900: "#04403D",
        },
        ink: {
          DEFAULT: "#0B1C30",
          soft: "#213145",
          mute: "#3F484E",
          fade: "#64748B",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F8FAFC", // background
          mute: "#F1F5F9",
          deep: "#E2E8F0",
        },
        outline: {
          DEFAULT: "#BEC8CE",
          soft: "rgba(190,200,206,0.35)",
          subtle: "rgba(190,200,206,0.2)",
        },
        accent: {
          glow: "#54FAEF",
          fixed: "#C1E8FF",
          dim: "#7CD1FB",
        },
        // Premium warm gold — extracted to match the signature "CHITS" treatment in the website logo screen
        gold: {
          DEFAULT: "#d4af37",
          light: "#f0c64b",
          dark: "#a9790a",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-2xl": ["clamp(2.75rem, 6vw, 5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display-xl": ["clamp(2.25rem, 5vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.625rem, 3vw, 2.25rem)", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
      },
      boxShadow: {
        "brand-sm": "0 2px 8px rgba(1, 120, 158, 0.06)",
        "brand-md": "0 8px 24px rgba(1, 120, 158, 0.08)",
        "brand-lg": "0 16px 40px rgba(1, 120, 158, 0.12)",
        "brand-xl": "0 24px 60px rgba(1, 120, 158, 0.18)",
        "brand-glow": "0 0 32px rgba(16, 215, 205, 0.32)",
        soft: "0 1px 3px rgba(11, 28, 48, 0.04), 0 4px 12px rgba(11, 28, 48, 0.04)",
        premium: "0 10px 30px -10px rgba(1, 120, 158, 0.35)",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #008B9C 0%, #00D1C1 100%)",
        "brand-gradient-deep": "linear-gradient(135deg, #01303F 0%, #01789E 55%, #10D7CD 100%)",
        "brand-radial": "radial-gradient(circle at 30% 20%, rgba(16,215,205,0.18), transparent 55%), radial-gradient(circle at 80% 80%, rgba(1,120,158,0.18), transparent 55%)",
        "mesh-hero": "radial-gradient(at 8% 12%, rgba(84,250,239,0.18) 0px, transparent 50%), radial-gradient(at 92% 18%, rgba(1,120,158,0.18) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(16,215,205,0.16) 0px, transparent 55%)",
        "grid-faint": "linear-gradient(rgba(1,120,158,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(1,120,158,0.05) 1px, transparent 1px)",
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fadeIn 0.6s ease-out both",
        marquee: "marquee 38s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulseRing 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 16s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.85)", opacity: "1" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundSize: {
        grid: "44px 44px",
      },
    },
  },
  plugins: [],
};

export default config;
