# VSYK CHITS — Website

A modern, premium, and engaging website for **VSYK CHITS** — built to mirror the branding and experience of the existing mobile application.

> Scope is **strictly limited to this `_VSYK_WEB` directory**. The mobile app, backend, and any other folder in the parent project remain untouched.

---

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS 3** with a fully tokenised VSYK design system
- **Framer Motion** for scroll, page, and micro-interactions
- **lucide-react** icons
- **next/font** with Space Grotesk (display) + Inter (body)

## Design system

Colors, typography, spacing, shadows, and radii were extracted directly from the mobile app source (`/Users/kirankishorev/Downloads/_VSYK/_VSYK/Frontend/lib/constants.ts` and `tailwind.config.js`). Highlights:

| Token | Value | Use |
|---|---|---|
| `brand.500` | `#01789E` | Primary deep teal-navy |
| `teal.500` | `#10D7CD` | Vibrant secondary |
| `accent.glow` | `#54FAEF` | Cyan glow accent |
| Gradient | `#008B9C → #00D1C1` | Signature brand gradient |
| `ink.DEFAULT` | `#0B1C30` | Body text |
| `surface.alt` | `#F8FAFC` | Page background |

Display font: **Space Grotesk**. Body font: **Inter**. Shadows use a custom blue-tinted premium shadow set identical to the mobile app's `Shadows.blueTint`.

## Pages

- **`/`** — Home: hero w/ animated phone mockup, trust stats counter, marquee, feature grid, 5-step process timeline, goals grid, MD leadership block, interactive chit calculator, member stories, FAQ, final CTA.
- **`/about`** — Brand story, mission/vision/promise pillars, leadership section, four core values, 30-year milestone timeline, compliance strip.
- **`/schemes`** — Filterable chit scheme catalog, comparison table, embedded calculator, FAQ.
- **`/how-it-works`** — Detailed 5-step walkthrough, required documents, four payment options, dividend explainer with worked example.
- **`/auctions`** — Live auction simulation, fairness principles, upcoming auctions table.
- **`/contact`** — Multi-channel support cards, lead capture form, map with HQ marker, office directory.

## Run locally

```bash
cd _VSYK_WEB
npm install
npm run dev
# → http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Project structure

```
_VSYK_WEB/
├── app/
│   ├── layout.tsx         # Root layout, fonts, metadata
│   ├── page.tsx           # Home composition
│   ├── globals.css        # Brand-tinted base layer + utilities
│   ├── about/page.tsx
│   ├── schemes/page.tsx
│   ├── how-it-works/page.tsx
│   ├── auctions/page.tsx
│   └── contact/page.tsx
├── components/
│   ├── layout/            # Navbar, Footer, ScrollProgress
│   ├── home/              # Hero, Features, HowItWorks, GoalsGrid, Leadership, ChitCalculator, Testimonials, FAQ, FinalCTA, TrustStats, TrustMarquee
│   ├── shared/            # PageHero, FadeIn, AnimatedCounter
│   ├── ui/                # Button, Container, SectionHeader
│   └── icons/             # Logo
├── lib/
│   └── utils.ts           # cn(), formatINR()
├── tailwind.config.ts     # Brand tokens & motion keyframes
├── postcss.config.mjs
├── tsconfig.json
└── next.config.mjs
```

## Animation philosophy

- All scroll-in animations use a single easing — `cubic-bezier(0.22, 1, 0.36, 1)` — for a consistent, refined feel.
- Hero stack uses parallax on the background mesh, with a phone mockup that floats in with a spring.
- The navbar morphs from glass to solid white as you scroll, with a `layoutId` underline that smoothly animates between active links.
- The five-step process uses a scroll-bound progress line that fills as the timeline enters view.
- The auction page contains a live, animated bid demo that simulates real auction dynamics.
- A scroll-progress bar at the very top of the page gives users a visual reading cue.

Every animation respects `prefers-reduced-motion` thresholds via Framer Motion's defaults.

## SEO

Set in `app/layout.tsx`:

- Sensible default `title` + per-page templating
- OpenGraph + Twitter card metadata
- `robots: index, follow`
- India locale
