---
name: VSYK Chits
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3f484e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6f787e'
  outline-variant: '#bec8ce'
  surface-tint: '#006687'
  primary: '#005e7d'
  on-primary: '#ffffff'
  primary-container: '#01789e'
  on-primary-container: '#e8f6ff'
  inverse-primary: '#7cd1fb'
  secondary: '#006a65'
  on-secondary: '#ffffff'
  secondary-container: '#54faef'
  on-secondary-container: '#00716b'
  tertiary: '#545759'
  on-tertiary: '#ffffff'
  tertiary-container: '#6d7072'
  on-tertiary-container: '#f2f4f6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1e8ff'
  primary-fixed-dim: '#7cd1fb'
  on-primary-fixed: '#001e2b'
  on-primary-fixed-variant: '#004d66'
  secondary-fixed: '#54faef'
  secondary-fixed-dim: '#23ddd3'
  on-secondary-fixed: '#00201e'
  on-secondary-fixed-variant: '#00504c'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-xl:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-padding: 20px
  gutter: 16px
---

## Brand & Style

This design system embodies the future of financial trust, blending the precision of high-end wealth management with the accessibility of modern consumer fintech. The brand personality is **authoritative yet frictionless**, designed to evoke a sense of security and technological advancement. 

The style is a **2026 Minimalist Fintech** aesthetic, characterized by an ultra-clean "iPhone 16 Pro" look. It merges the structural hierarchy of Apple’s Human Interface Guidelines (HIG) with the personalization and dynamic layering of Material You. The interface relies on generous white space, soft blue-tinted elevation, and high-precision typography to create a premium, calm environment for managing savings and investments.

## Colors

The palette is anchored by **Deep Navy Blue**, providing a foundation of stability and professional banking heritage. This is contrasted by **Vibrant Teal**, used strategically as an action color to draw attention to growth, success, and interactive elements. 

- **Primary (Deep Navy):** Used for core branding, primary buttons, and critical information.
- **Accent (Teal):** Reserved for growth indicators, positive trends, and "Success" states.
- **Background:** A soft off-white with a slight cool bias to reduce eye strain and feel modern.
- **Surface:** Pure white cards to ensure high legibility and a crisp distinction from the background.

## Typography

The typography strategy utilizes a dual-font system to balance character with utility. 

**Space Grotesk** is the choice for headlines, providing a geometric, tech-forward "Sprint" aesthetic that feels innovative and distinctive. **Inter** is the workhorse for all body copy and functional data, chosen for its exceptional legibility in financial contexts and its neutral, systematic feel. High-contrast weights are used to establish a clear hierarchy, with wide tracking for labels and tight tracking for large displays.

## Layout & Spacing

This design system employs a **Fixed Grid** model for desktop (1280px container) and a **Fluid Layout** for mobile. The rhythm is based on a 4px baseline grid to ensure mathematical alignment across all components.

- **Margins:** A generous 20px "Safe Area" margin for mobile devices.
- **Section Spacing:** 48px (xxl) between major layout blocks to maintain the minimalist feel.
- **Component Padding:** Internal card padding is set to 24px (lg) to create a premium, uncrowded atmosphere typical of high-end financial apps.

## Elevation & Depth

Depth is communicated through **Ambient Shadows** and tonal layering rather than heavy borders. The "iPhone 16 Pro" aesthetic is achieved through:

1.  **Blue-Tinted Shadows:** Shadows are never pure gray. They use a very low-opacity Deep Navy (`#01789E` at 8-12% alpha) with large blur radii (20px+) to create a soft, atmospheric lift.
2.  **Surface Tiers:** Background (`#F8FAFC`) is the lowest level. Pure white cards (`#FFFFFF`) sit on top. Modals and pop-overs use a subtle backdrop blur (20px) to maintain context.
3.  **Active States:** When pressed, elements should visually "sink" by reducing shadow spread and slightly scaling down (98%), mimicking a physical haptic response.

## Shapes

The shape language is defined by **large, friendly radii** that signal approachability and modern software trends.

- **Primary Cards:** 20px corner radius.
- **Buttons & Inputs:** 12px-16px corner radius.
- **Chips:** Fully rounded (Pill) for categorical distinction.
- **Icon Enclosures:** Rounded squares (Squicles) with a 12px radius to house the thin-line iconography.

The logo is a stylized diamond, and this angularity is reflected subtly in the "swoosh" elements of progress bars and line graphs, contrasting against the otherwise rounded UI.

## Components

- **Buttons:** Primary buttons are solid Deep Navy with white text. Secondary buttons use a Teal-tinted ghost style with a 1px border. All buttons use 16px vertical padding for a "fat," touch-friendly surface.
- **Cards:** The hallmark of the system. Pure white, 20px radius, with a subtle 1px border in a very light blue tint (`#E2E8F0`) and a soft blue-tinted shadow.
- **Input Fields:** Minimalist design with a 1px border that transforms into a 2px Teal border on focus. Labels use the `label-md` uppercase style for a professional look.
- **Chit Progress Trackers:** Custom radial or linear gauges using the Teal accent to show payment completion and dividend earnings.
- **Iconography:** 24px grid, 1.5pt stroke weight. Icons are primarily Deep Navy, with specific functional parts (like an arrow or a "plus" sign) highlighted in Teal.
- **Lists:** High-density data lists use "Divided Row" patterns with 16px padding and light gray separators, keeping the focus on the numbers.