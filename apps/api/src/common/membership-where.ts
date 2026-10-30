import { Prisma } from "@illyrian/database";

/**
 * Prisma filters for the freeze window. They are written out explicitly because the obvious
 * `NOT { frozenFrom <= now AND frozenUntil > now }` is NULL (not true) for memberships that were never frozen,
 * which silently drops them from every list. Use these helpers instead of re-deriving the condition.
 */
export function frozenNow(now: Date): Prisma.MembershipWhereInput {
  return { frozenFrom: { lte: now }, frozenUntil: { gt: now } };
}

export function notFrozenNow(now: Date): Prisma.MembershipWhereInput {
  return { OR: [{ frozenFrom: null }, { frozenUntil: null }, { frozenFrom: { gt: now } }, { frozenUntil: { lte: now } }] };
}

/** A membership that is running right now and lets the member in: not cancelled, started, not ended, not frozen. */
export function runningNow(now: Date): Prisma.MembershipWhereInput {
  return { AND: [{ status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } }, notFrozenNow(now)] };
}
