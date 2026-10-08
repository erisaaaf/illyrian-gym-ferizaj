// Illyrian Gym Ferizaj - shared design tokens
//
// PLACEHOLDER PALETTE: no official Illyrian Gym Ferizaj branding assets
// (logo, color guide, typeface) have been provided yet. These tokens are a
// deliberately neutral "athletic/premium" starting point so mobile + admin
// stay visually consistent while real branding is pending - see section 14
// of the product spec. Swap the `color` values below once brand assets
// exist; every screen should read tokens from here rather than hardcoding
// hex values.

export const color = {
  // Base surfaces - near-black, not pure black, for a premium feel.
  background: "#0B0C0E",
  surface: "#151619",
  surfaceElevated: "#1E2023",
  border: "#2A2C30",

  // Text
  textPrimary: "#F5F5F4",
  textSecondary: "#A5A7AC",
  textMuted: "#6B6D72",
  textInverse: "#0B0C0E",

  // Brand accent - placeholder crimson, swap for official brand color.
  accent: "#E1362C",
  accentMuted: "#7A211C",
  accentContrast: "#FFFFFF",

  // Semantic
  success: "#33C481",
  warning: "#E8A73B",
  danger: "#E1362C",
  info: "#3B9CE8",

  // Status badges (membership / PR verification / booking)
  statusActive: "#33C481",
  statusExpiringSoon: "#E8A73B",
  statusExpired: "#8A8C90",
  statusVerified: "#3B9CE8",
  statusUnverified: "#8A8C90",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  fontFamily: {
    // System-default fallbacks until an official brand typeface is chosen.
    sans: "Inter, -apple-system, Roboto, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    display: 40,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const shadow = {
  card: "0 4px 16px rgba(0, 0, 0, 0.35)",
  modal: "0 12px 40px rgba(0, 0, 0, 0.5)",
} as const;

export const tokens = { color, spacing, radius, typography, shadow };
