import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { GymRulesService } from "../../common/gym-rules.service";
import { QrService } from "../../common/qr.service";
import { findCurrentMembership } from "../../common/current-membership";
import { gymPeriodStart } from "../../common/gym-time";
import { paginate, skipTake } from "../../common/pagination.util";
import { allowsEntry, computeMembershipStatus, daysRemaining } from "../../common/membership-status.util";
import { CheckInDto, ListVisitsQueryDto } from "./dto/check-in.dto";

export type CheckInOutcome =
  | "OK"
  | "DUPLICATE"
  | "EXPIRED"
  | "FROZEN"
  | "NOT_STARTED"
  | "CANCELLED"
  | "NO_MEMBERSHIP"
  | "UNPAID"
  | "SUSPENDED"
  | "INVALID_CODE"
  | "NOT_FOUND";

const MESSAGES: Record<Exclude<CheckInOutcome, "OK">, string> = {
  DUPLICATE: "Already checked in a moment ago.",
  EXPIRED: "Membership has expired.",
  FROZEN: "Membership is frozen.",
  NOT_STARTED: "Membership has not started yet.",
  CANCELLED: "Membership was cancelled.",
  NO_MEMBERSHIP: "This member has no membership.",
  UNPAID: "Membership is unpaid and the gym requires payment before entry.",
  SUSPENDED: "This account is not active.",
  INVALID_CODE: "This QR code is not valid. It may have been replaced - ask the member to open their current card.",
  NOT_FOUND: "No member found.",
};

@Injectable()
export class CheckInService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: GymRulesService,
    private readonly qr: QrService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>("GYM_TIMEZONE")!;
  }

  /**
   * Verifies the member server-side (the QR only identifies them) and records the entry. The result always carries
   * an `outcome` the desk can show at a glance; a refusal is a normal answer, not an error.
   */
  async checkIn(dto: CheckInDto, staffId: string) {
    const given = [dto.code, dto.memberNumber, dto.userId].filter(Boolean).length;
    if (given !== 1) throw new BadRequestException("Provide exactly one of: QR code, member number, or member");

    // 1. Who is this?
    let userId: string | undefined;
    if (dto.code) {
      const parsed = this.qr.parse(dto.code);
      if (!parsed) return this.refuse("INVALID_CODE", null, null);
      userId = parsed.userId;
    } else if (dto.memberNumber) {
      const byNumber = await this.prisma.client.user.findFirst({ where: { memberNumber: { equals: dto.memberNumber.trim(), mode: "insensitive" }, role: "MEMBER" }, select: { id: true } });
      userId = byNumber?.id;
    } else {
      userId = dto.userId;
    }

    const user = userId
      ? await this.prisma.client.user.findFirst({ where: { id: userId, role: "MEMBER" }, select: { id: true, firstName: true, lastName: true, memberNumber: true, status: true, qrVersion: true, assignedCoach: { select: { user: { select: { firstName: true, lastName: true } } } } } })
      : null;
    if (!user) return this.refuse("NOT_FOUND", null, null);
    if (dto.code && this.qr.parse(dto.code)?.version !== user.qrVersion) return this.refuse("INVALID_CODE", user, null);

    const member = { id: user.id, name: `${user.firstName} ${user.lastName}`, memberNumber: user.memberNumber };
    if (user.status !== "ACTIVE") return this.refuse("SUSPENDED", member, null);

    // 2. Do they have a membership that lets them in right now?
    const rules = await this.rules.get();
    const now = new Date();
    const membership = await findCurrentMembership(this.prisma, user.id, { plan: { select: { name: true, planType: true } } }, now);
    if (!membership) return this.refuse("NO_MEMBERSHIP", member, null);

    const status = computeMembershipStatus(membership, { now, expiringSoonDays: rules.expiringSoonDays });
    const summary = { id: membership.id, status, plan: membership.plan.name, endDate: membership.endDate, daysRemaining: daysRemaining(membership.endDate, now), paymentStatus: membership.paymentStatus };
    if (status === "CANCELLED") return this.refuse("CANCELLED", member, summary);
    if (status === "FROZEN") return this.refuse("FROZEN", member, summary);
    if (status === "EXPIRED") return this.refuse("EXPIRED", member, summary);
    if (membership.startDate > now) return this.refuse("NOT_STARTED", member, summary);
    if (!allowsEntry(status)) return this.refuse("EXPIRED", member, summary);
    if (rules.blockUnpaidCheckIn && membership.paymentStatus === "UNPAID") return this.refuse("UNPAID", member, summary);

    // 3. Record the entry - serialised per member, so two scanners (or a double tap) cannot both record it.
    const method = dto.code ? "QR" : "MANUAL";
    const result = await this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      const since = new Date(now.getTime() - rules.duplicateScanMinutes * 60_000);
      const recent = rules.duplicateScanMinutes > 0 ? await tx.gymVisit.findFirst({ where: { userId: user.id, checkedInAt: { gte: since } }, orderBy: { checkedInAt: "desc" } }) : null;
      if (recent) return { duplicate: recent };
      const visit = await tx.gymVisit.create({ data: { userId: user.id, membershipId: membership.id, method, recordedById: staffId, checkedInAt: now } });
      return { visit };
    });

    if (result.duplicate) {
      return { ...this.refuse("DUPLICATE", member, summary), duplicateOf: result.duplicate.checkedInAt };
    }

    const visitCount = await this.prisma.client.gymVisit.count({ where: { userId: user.id } });
    await this.audit.record({ actorId: staffId, action: "check_in.record", entityType: "GymVisit", entityId: result.visit.id, metadata: { userId: user.id, method } });
    return {
      outcome: "OK" as const,
      allowed: true,
      message: status === "EXPIRING_SOON" ? `Welcome in. Membership ends in ${summary.daysRemaining} day${summary.daysRemaining === 1 ? "" : "s"}.` : "Welcome in.",
      member: { ...member, assignedTrainer: user.assignedCoach ? `${user.assignedCoach.user.firstName} ${user.assignedCoach.user.lastName}` : null },
      membership: summary,
      visit: { id: result.visit.id, checkedInAt: result.visit.checkedInAt },
      visitCount,
    };
  }

  private refuse(outcome: Exclude<CheckInOutcome, "OK">, member: { id?: string; name?: string; memberNumber?: string | null } | null, membership: unknown) {
    return { outcome, allowed: false, message: MESSAGES[outcome], member: member?.name ? member : null, membership };
  }

  // --- Reading ------------------------------------------------------------------------------------

  /** Today's entries (in the gym's calendar day) newest first - the reception screen's live list. */
  async today(limit = 30) {
    const since = gymPeriodStart("day", this.tz);
    const where: Prisma.GymVisitWhereInput = { checkedInAt: { gte: since } };
    const [count, rows, unique] = await Promise.all([
      this.prisma.client.gymVisit.count({ where }),
      this.prisma.client.gymVisit.findMany({
        where,
        orderBy: { checkedInAt: "desc" },
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, memberNumber: true } }, membership: { select: { plan: { select: { name: true } } } } },
      }),
      this.prisma.client.gymVisit.findMany({ where, distinct: ["userId"], select: { userId: true } }),
    ]);
    return { since, count, uniqueMembers: unique.length, recent: rows };
  }

  async list(query: ListVisitsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.GymVisitWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to ? { checkedInAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      ...(query.search
        ? { user: { OR: [{ firstName: { contains: query.search, mode: "insensitive" } }, { lastName: { contains: query.search, mode: "insensitive" } }, { memberNumber: { contains: query.search, mode: "insensitive" } }] } }
        : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.gymVisit.findMany({
        where,
        orderBy: { checkedInAt: "desc" },
        include: { user: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.gymVisit.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async mine(userId: string, query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = { userId };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.gymVisit.findMany({ where, orderBy: { checkedInAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.gymVisit.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  /** The member's digital card: number, name, QR token and the status of their current membership. */
  async card(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    const rules = await this.rules.get();
    const membership = await findCurrentMembership(this.prisma, userId, { plan: { select: { name: true, planType: true, period: true } } });
    const visitCount = await this.prisma.client.gymVisit.count({ where: { userId } });
    return {
      memberNumber: user.memberNumber,
      name: `${user.firstName} ${user.lastName}`,
      qrToken: this.qr.issue(user.id, user.qrVersion),
      visitCount,
      membership: membership
        ? {
            plan: membership.plan.name,
            planType: membership.plan.planType,
            period: membership.plan.period,
            startDate: membership.startDate,
            endDate: membership.endDate,
            daysRemaining: daysRemaining(membership.endDate),
            status: computeMembershipStatus(membership, { expiringSoonDays: rules.expiringSoonDays }),
          }
        : null,
    };
  }
}
