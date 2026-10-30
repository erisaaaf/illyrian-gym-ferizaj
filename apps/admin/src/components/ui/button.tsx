import { ButtonHTMLAttributes, forwardRef } from "react";

// Website buttons: fully round, Manrope bold. Primary is the lime fill with INK text (lime is a light
// colour, white text on it would fail contrast).
const VARIANTS = {
  primary: "bg-accent text-accent-contrast font-bold hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface font-semibold text-text-primary hover:bg-surface-sunken",
  dark: "bg-ink font-semibold text-mint hover:bg-ink-3",
  // Red is for destructive actions only.
  danger: "bg-danger font-semibold text-white hover:brightness-95",
  ghost: "font-semibold text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3.5 text-xs",
  md: "h-10 gap-2 px-5 text-sm",
  lg: "h-12 gap-2 px-7 text-sm",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, disabled, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-pill transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

/** Square-ish icon-only button; `label` is required because there is no visible text. */
export function IconButton({
  label,
  className = "",
  children,
  variant = "ghost",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string; variant?: "ghost" | "secondary" | "dark" }) {
  const styles = {
    ghost: "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
    secondary: "border border-border-strong bg-surface text-text-primary hover:bg-surface-sunken",
    dark: "bg-ink text-mint hover:bg-ink-3",
  }[variant];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill transition disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
