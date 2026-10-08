import type { Config } from "tailwindcss";
import { color, spacing, radius } from "@illyrian/config";

// Tailwind theme driven by the shared design tokens (packages/config) so
// admin and mobile never drift apart. See packages/config/src/design-tokens.ts
// for the placeholder-branding note.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: color.background,
        surface: color.surface,
        "surface-elevated": color.surfaceElevated,
        border: color.border,
        "text-primary": color.textPrimary,
        "text-secondary": color.textSecondary,
        "text-muted": color.textMuted,
        accent: color.accent,
        "accent-muted": color.accentMuted,
        success: color.success,
        warning: color.warning,
        danger: color.danger,
        info: color.info,
      },
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, `${v}px`])),
      borderRadius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])),
    },
  },
  plugins: [],
};

export default config;
