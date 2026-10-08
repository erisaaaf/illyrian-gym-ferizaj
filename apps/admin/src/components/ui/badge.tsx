// Neutral by default. Red/danger is reserved for errors, destructive
// actions, and expired/critical states - not for ordinary navigation or
// data (spec section 3/23).
const VARIANTS = {
  neutral: "bg-surface-elevated text-text-secondary border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-info/15 text-info border-info/30",
  accent: "bg-accent/15 text-accent border-accent/30",
} as const;

export function Badge({ children, variant = "neutral" }: { children: React.ReactNode; variant?: keyof typeof VARIANTS }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}

const MEMBERSHIP_VARIANTS: Record<string, keyof typeof VARIANTS> = {
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
  NONE: "neutral",
};

export function MembershipStatusBadge({ status }: { status: string }) {
  return <Badge variant={MEMBERSHIP_VARIANTS[status] ?? "neutral"}>{formatStatus(status)}</Badge>;
}

const USER_STATUS_VARIANTS: Record<string, keyof typeof VARIANTS> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
};

export function UserStatusBadge({ status }: { status: string }) {
  return <Badge variant={USER_STATUS_VARIANTS[status] ?? "neutral"}>{formatStatus(status)}</Badge>;
}

export function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
