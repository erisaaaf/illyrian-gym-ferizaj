// Status colour is semantic and consistent everywhere:
//   green = good / active / paid     amber = needs attention (expiring, pending, partial)
//   red   = problem / destructive (expired, overdue, suspended, voided)     blue = informational
//   cyan  = frozen                   neutral = no status
// Red is never used for ordinary navigation or decoration.
const VARIANTS = {
  neutral: "bg-surface-sunken text-text-secondary border-border",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/25",
  info: "bg-info/10 text-info border-info/25",
  frozen: "bg-frozen/10 text-frozen border-frozen/25",
  accent: "bg-accent-muted text-accent-text border-accent/60",
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export function Badge({ children, variant = "neutral", dot = false }: { children: React.ReactNode; variant?: BadgeVariant; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-semibold ${VARIANTS[variant]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

const MEMBERSHIP_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  FROZEN: "frozen",
  CANCELLED: "neutral",
  NONE: "neutral",
};

export function MembershipStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={MEMBERSHIP_VARIANTS[status] ?? "neutral"} dot>
      {formatStatus(status)}
    </Badge>
  );
}

const USER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
};

export function UserStatusBadge({ status }: { status: string }) {
  return <Badge variant={USER_STATUS_VARIANTS[status] ?? "neutral"}>{formatStatus(status)}</Badge>;
}

const PAYMENT_VARIANTS: Record<string, BadgeVariant> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "warning",
  UNPAID: "neutral",
  OVERDUE: "danger",
  VOID: "neutral",
  VOIDED: "neutral",
  COMPLETED: "success",
};

/** Invoice / payment status. */
export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={PAYMENT_VARIANTS[status] ?? "neutral"} dot>
      {formatStatus(status)}
    </Badge>
  );
}

export function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
