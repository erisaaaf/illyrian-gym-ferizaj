export type ComputedMembershipStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "FROZEN" | "CANCELLED";

export const DEFAULT_EXPIRING_SOON_DAYS = 7;

interface StatusInput {
  status: "ACTIVE" | "CANCELLED";
  endDate: Date;
  frozenFrom?: Date | null;
  frozenUntil?: Date | null;
}

/**
 * Membership status is never stored as ACTIVE/EXPIRING_SOON/EXPIRED/FROZEN - only whether it was
 * administratively CANCELLED is persisted (Membership.status). Everything else is derived at query time
 * from the dates, so it never drifts from reality:
 *
 *   CANCELLED     administratively cancelled
 *   FROZEN        "now" is inside the freeze window [frozenFrom, frozenUntil)
 *   EXPIRED       endDate has passed (endDate already includes any frozen days that were added)
 *   EXPIRING_SOON ends within `expiringSoonDays` (a gym setting, default 7)
 *   ACTIVE        otherwise
 */
export function computeMembershipStatus(
  membership: StatusInput,
  opts: { now?: Date; expiringSoonDays?: number } = {},
): ComputedMembershipStatus {
  const now = (opts.now ?? new Date()).getTime();
  const windowDays = opts.expiringSoonDays ?? DEFAULT_EXPIRING_SOON_DAYS;

  if (membership.status === "CANCELLED") return "CANCELLED";
  if (membership.frozenFrom && membership.frozenUntil && membership.frozenFrom.getTime() <= now && now < membership.frozenUntil.getTime()) {
    return "FROZEN";
  }
  const msUntilExpiry = membership.endDate.getTime() - now;
  if (msUntilExpiry < 0) return "EXPIRED";
  if (msUntilExpiry <= windowDays * 86_400_000) return "EXPIRING_SOON";
  return "ACTIVE";
}

/** Whether a membership of this status lets the member book classes and enter the gym. */
export function allowsEntry(status: ComputedMembershipStatus): boolean {
  return status === "ACTIVE" || status === "EXPIRING_SOON";
}

/** Whole days left until the membership ends (0 once it has ended). */
export function daysRemaining(endDate: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000));
}
