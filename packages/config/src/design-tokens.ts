// Illyrian Gym & CrossFit - shared design tokens
//
// SOURCE: the official website (https://illyrian-gym.vercel.app/). `brand` below was read from the
// site's own CSS custom properties (--brand, --ink, --mint ...), not guessed - see docs/design-system.md.
// Tokens marked DERIVED are not on the website: they are the minimum extra values an application UI
// needs (text-safe variants, status colours, hairlines) chosen to stay inside the same palette and to
// meet WCAG AA contrast on the surface they are used on.
//
// Two palettes share the brand:
//   - `color`      : dark "ink" theme - the website hero/gallery/contact look. Used by the mobile app.
//   - `adminColor` : light "mint" canvas + white cards - the website's services/membership look,
//                    with an ink sidebar. Used by the admin/staff web dashboard (dense data reads better on light).

/** Verified from the website's CSS. */
export const brand = {
  lime: "#bfff00", // --brand: primary accent (buttons, active states, highlights)
  limePale: "#dfff8a", // --brand-pale
  limeSoft: "#aeea00", // --brand-soft: hover
  moss: "#6e9900", // --moss: eyebrow labels, accent text on light surfaces (large/bold only)
  ink: "#0a0d0b", // --ink: near-black background
  ink2: "#171c18", // --ink-2 / --card: raised surface on dark
  ink3: "#232923", // --ink-3: highest surface on dark
  inkSoft: "#343a35", // --ink-soft
  mint: "#f5f7f0", // --mint / --paper-2: light canvas
  paper: "#ffffff", // --paper
  muted: "#d5dbd2", // --muted
  muted2: "#9fa89f", // --muted-2
} as const;

/** DERIVED: shades the site does not define but the UI needs. */
export const derived = {
  mossText: "#4a6600", // moss darkened until it reads at body size on white (AA, ~6.5:1)
  limeTint: "#f0ffbf", // lime at ~25% on white: selected rows, subtle highlights
  textMutedOnLight: "#566057", // muted text on white/mint (AA, ~6.3:1)
  lineOnLight: "rgba(10, 13, 11, 0.08)", // the website's card border
  lineOnDark: "rgba(245, 247, 240, 0.10)", // hairline on ink surfaces
} as const;

/** Dark theme (mobile app). Keys are semantic and stable: screens read these, never hex values. */
export const color = {
  background: brand.ink,
  surface: brand.ink2,
  surfaceElevated: brand.ink3,
  border: "#2b322c",

  textPrimary: brand.mint,
  textSecondary: brand.muted,
  textMuted: brand.muted2,
  textInverse: brand.ink,

  accent: brand.lime,
  accentMuted: "#33430a", // lime on ink at low strength: selected chips, own chat bubbles
  accentContrast: brand.ink, // text on a lime fill (lime is light: ink text, never white)

  // Semantic. Distinct from the lime brand colour so "success" never reads as "brand".
  success: "#3ddc97",
  warning: "#f5a524",
  danger: "#ff6159",
  info: "#5aa9ff",
  frozen: "#5fd4e8",

  statusActive: "#3ddc97",
  statusExpiringSoon: "#f5a524",
  statusExpired: "#8b958c",
  statusFrozen: "#5fd4e8",
  statusVerified: "#5aa9ff",
  statusUnverified: "#8b958c",
} as const;

/** Light theme (admin / staff web). Same keys as `color`, plus sidebar tokens. */
export const adminColor = {
  background: brand.mint,
  surface: brand.paper,
  surfaceElevated: "#fafbf6",
  surfaceSunken: "#eef1e6",
  border: derived.lineOnLight,
  borderStrong: "rgba(10, 13, 11, 0.16)",

  textPrimary: brand.ink,
  textSecondary: brand.inkSoft,
  textMuted: derived.textMutedOnLight,
  textInverse: brand.mint,

  accent: brand.lime,
  accentHover: brand.limeSoft,
  accentText: derived.mossText,
  accentMuted: derived.limeTint,
  accentContrast: brand.ink,

  success: "#1b7f4b",
  warning: "#9a5b00",
  danger: "#c0362c",
  info: "#1f5fbf",
  frozen: "#0e7490",

  // Always-dark navigation rail (like the website header)
  sidebar: brand.ink,
  sidebarSurface: brand.ink2,
  sidebarText: "rgba(245, 247, 240, 0.72)",
  sidebarTextMuted: "rgba(245, 247, 240, 0.45)",
  sidebarLine: derived.lineOnDark,
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

/** The website: cards ~22-27px radius, buttons and chips fully round. */
export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  fontFamily: {
    // Sora 800 for headings, Manrope for everything else - both loaded by the apps (next/font, expo-font).
    heading: "Sora, system-ui, sans-serif",
    sans: "Manrope, system-ui, sans-serif",
    mono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
  },
  // Native font family names as registered by expo-font
  native: {
    heading: "Sora_800ExtraBold",
    headingBold: "Sora_700Bold",
    body: "Manrope_500Medium",
    bodySemi: "Manrope_600SemiBold",
    bodyBold: "Manrope_700Bold",
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
    extrabold: "800",
  },
  // Website heading rhythm: Sora 800, tight tracking, line-height ~1
  tracking: {
    heading: -0.05, // em
    eyebrow: 0.22, // em (uppercase 11.5px labels)
    nav: 0.05, // em (uppercase 11px navigation)
  },
} as const;

export const shadow = {
  // The website uses borders, not shadows, for cards; shadows are reserved for floating layers.
  card: "0 1px 2px rgba(10, 13, 11, 0.04)",
  popover: "0 12px 32px rgba(10, 13, 11, 0.14)",
  modal: "0 24px 64px rgba(10, 13, 11, 0.28)",
} as const;

export const tokens = { brand, derived, color, adminColor, spacing, radius, typography, shadow };
