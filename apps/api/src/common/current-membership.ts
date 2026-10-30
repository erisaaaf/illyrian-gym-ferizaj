import { Prisma } from "@illyrian/database";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The membership that governs a member RIGHT NOW. Renewals can overlap or start in the future, so
 * "latest end date" is not enough:
 *   1. a non-cancelled membership that covers today (started, not yet ended)  - preferred
 *   2. otherwise the non-cancelled one that ends last (an expired one, or a renewal that has not started)
 *   3. otherwise the most recent cancelled one (so the status can say CANCELLED)
 */
export async function findCurrentMembership<I extends Prisma.MembershipInclude = Record<string, never>>(
  prisma: PrismaService,
  userId: string,
  include?: I,
  now: Date = new Date(),
): Promise<Prisma.MembershipGetPayload<{ include: I }> | null> {
  type Row = Prisma.MembershipGetPayload<{ include: I }>;
  const opts = { include: include as I | undefined };
  const covering = await prisma.client.membership.findFirst({
    where: { userId, status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { endDate: "desc" },
    ...opts,
  });
  if (covering) return covering as unknown as Row;

  const latestActive = await prisma.client.membership.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { endDate: "desc" }, ...opts });
  if (latestActive) return latestActive as unknown as Row;

  const any = await prisma.client.membership.findFirst({ where: { userId }, orderBy: { endDate: "desc" }, ...opts });
  return (any as unknown as Row) ?? null;
}

interface PickableMembership {
  status: "ACTIVE" | "CANCELLED";
  startDate: Date;
  endDate: Date;
}

/** Same rule as `findCurrentMembership`, for a list already in memory (used by member lists to avoid N queries). */
export function pickCurrentMembership<T extends PickableMembership>(memberships: T[], now: Date = new Date()): T | undefined {
  const byEndDesc = [...memberships].sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  return (
    byEndDesc.find((m) => m.status === "ACTIVE" && m.startDate <= now && m.endDate >= now) ??
    byEndDesc.find((m) => m.status === "ACTIVE") ??
    byEndDesc[0]
  );
}
