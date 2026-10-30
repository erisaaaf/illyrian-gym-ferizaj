import type { Config } from "tailwindcss";
import { adminColor, brand, spacing, radius, shadow } from "@illyrian/config";

// Tailwind theme driven by the shared design tokens (packages/config). The brand values come from the
// official website; see packages/config/src/design-tokens.ts and docs/design-system.md.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic (light canvas) - use these in screens
        background: adminColor.background,
        surface: adminColor.surface,
        "surface-elevated": adminColor.surfaceElevated,
        "surface-sunken": adminColor.surfaceSunken,
        border: adminColor.border,
        "border-strong": adminColor.borderStrong,
        "text-primary": adminColor.textPrimary,
        "text-secondary": adminColor.textSecondary,
        "text-muted": adminColor.textMuted,
        accent: adminColor.accent, // lime FILL (buttons, active markers). Never use lime as text on light.
        "accent-hover": adminColor.accentHover,
        "accent-text": adminColor.accentText, // brand-coloured TEXT/links on light surfaces
        "accent-muted": adminColor.accentMuted,
        "accent-contrast": adminColor.accentContrast,
        success: adminColor.success,
        warning: adminColor.warning,
        danger: adminColor.danger,
        info: adminColor.info,
        frozen: adminColor.frozen,
        // Dark navigation rail
        sidebar: adminColor.sidebar,
        "sidebar-surface": adminColor.sidebarSurface,
        "sidebar-text": adminColor.sidebarText,
        "sidebar-muted": adminColor.sidebarTextMuted,
        "sidebar-line": adminColor.sidebarLine,
        // Raw brand palette (rare: hero/login panels)
        ink: brand.ink,
        lime: brand.lime,
        moss: brand.moss,
        mint: brand.mint,
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        heading: ["var(--font-sora)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        heading: "-0.05em",
        eyebrow: "0.22em",
        nav: "0.05em",
      },
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, `${v}px`])),
      borderRadius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])),
      boxShadow: {
        card: shadow.card,
        popover: shadow.popover,
        modal: shadow.modal,
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 180ms ease-out",
        "slide-in-right": "slide-in-right 220ms ease-out",
        "slide-in-left": "slide-in-left 220ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
