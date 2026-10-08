export type ComputedMembershipStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED";

const EXPIRING_SOON_WINDOW_DAYS = 7;

/**
 * Membership status is never stored as ACTIVE/EXPIRING_SOON/EXPIRED - only
 * whether it was administratively CANCELLED is persisted (Membership.status
 * in the schema). Everything else is derived from `endDate` at query time
 * so it never drifts from the actual date - see docs/architecture.md.
 */
export function computeMembershipStatus(membership: {
  status: "ACTIVE" | "CANCELLED";
  endDate: Date;
}): ComputedMembershipStatus {
  if (membership.status === "CANCELLED") return "CANCELLED";
  const msUntilExpiry = membership.endDate.getTime() - Date.now();
  if (msUntilExpiry < 0) return "EXPIRED";
  if (msUntilExpiry <= EXPIRING_SOON_WINDOW_DAYS * 86_400_000) return "EXPIRING_SOON";
  return "ACTIVE";
}
