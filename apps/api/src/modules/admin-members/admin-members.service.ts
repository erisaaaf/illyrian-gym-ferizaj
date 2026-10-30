import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { Prisma, Role } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { GymRulesService } from "../../common/gym-rules.service";
import { QrService } from "../../common/qr.service";
import { SequencesService } from "../../common/sequences.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { pickCurrentMembership } from "../../common/current-membership";
import { frozenNow, runningNow } from "../../common/membership-where";
import { paginate, skipTake } from "../../common/pagination.util";
import { generateTempPassword } from "../../common/security/temp-password.util";
import { computeMembershipStatus, daysRemaining } from "../../common/membership-status.util";
import { balanceOf, deriveInvoiceStatus, sumCompleted } from "../finance/finance.util";
import { ListMembersQueryDto } from "./dto/list-members.query.dto";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { SetMemberStatusDto } from "./dto/set-member-status.dto";

const DAY_MS = 86_400_000;

const MEMBER_LIST_SELECT = {
  id: true,
  memberNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  mustChangePassword: true,
  assignedCoach: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  memberships: {
    orderBy: { endDate: "desc" as const },
    take: 6,
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      paymentStatus: true,
      frozenFrom: true,
      frozenUntil: true,
      plan: { select: { id: true, name: true, planType: true, period: true } },
    },
  },
} satisfies Prisma.UserSelect;

const isStaffWithNotes = (role: string) => role === "ADMIN" || role === "RECEPTIONIST";

@Injectable()
export class AdminMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly rules: GymRulesService,
    private readonly qr: QrService,
    private readonly sequences: SequencesService,
  ) {}

  // --- Listing -------------------------------------------------------------------------------

  async list(query: ListMembersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const rules = await this.rules.get();
    const now = new Date();

    const filters: Prisma.UserWhereInput[] = [{ role: Role.MEMBER }];
    if (query.status) filters.push({ status: query.status });
    if (query.coachId) filters.push({ assignedCoachId: query.coachId });
    if (query.search) {
      filters.push({
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search, mode: "insensitive" } },
          { memberNumber: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.category) filters.push(await this.categoryFilter(query.category, now, rules.expiringSoonDays, query.atRiskDays ?? rules.atRiskShortDays));

    const where: Prisma.UserWhereInput = { AND: filters };
    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({ where, select: MEMBER_LIST_SELECT, orderBy: { createdAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);
    const [visits, balances] = await Promise.all([this.visitStats(ids), this.balances(ids)]);
    const data = users.map((u) => this.present(u, rules.expiringSoonDays, { visits: visits.get(u.id), balanceCents: balances.get(u.id) ?? 0 }));
    return paginate(data, total, page, pageSize);
  }

  /** Builds the Prisma filter for one of the requirement's member categories. */
  private async categoryFilter(category: NonNullable<ListMembersQueryDto["category"]>, now: Date, expiringSoonDays: number, atRiskDays: number): Promise<Prisma.UserWhereInput> {
    const soon = new Date(now.getTime() + expiringSoonDays * DAY_MS);

    switch (category) {
      case "ACTIVE":
        return { memberships: { some: runningNow(now) } };
      case "EXPIRING_SOON":
        return { memberships: { some: { AND: [runningNow(now), { endDate: { lte: soon } }] } } };
      case "FROZEN":
        return { memberships: { some: { status: "ACTIVE", ...frozenNow(now) } } };
      case "EXPIRED":
        // Had memberships, none of them still running or coming up.
        return { memberships: { some: {} }, NOT: { memberships: { some: { status: "ACTIVE", endDate: { gte: now } } } } };
      case "NO_MEMBERSHIP":
        return { memberships: { none: {} } };
      case "NEW":
        return { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } };
      case "INACTIVE":
        return { status: { not: "ACTIVE" } };
      case "UNPAID": {
        const rows = await this.prisma.client.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
          SELECT i."userId" FROM "Invoice" i
          LEFT JOIN (SELECT "invoiceId", SUM("amountCents") AS paid FROM "Payment" WHERE status = 'COMPLETED' GROUP BY "invoiceId") p ON p."invoiceId" = i.id
          WHERE i.status = 'OPEN' GROUP BY i."userId" HAVING SUM(GREATEST(i."totalCents" - COALESCE(p.paid, 0), 0)) > 0`);
        return { id: { in: rows.map((r) => r.userId) } };
      }
      case "AT_RISK": {
        // Has a running membership but has not been to the gym for N days (and has had N days to do so).
        const since = new Date(now.getTime() - atRiskDays * DAY_MS);
        return { status: "ACTIVE", createdAt: { lt: since }, memberships: { some: runningNow(now) }, visits: { none: { checkedInAt: { gte: since } } } };
      }
    }
  }

  private async visitStats(ids: string[]) {
    if (ids.length === 0) return new Map<string, { count: number; last: Date | null }>();
    const rows = await this.prisma.client.gymVisit.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true }, _max: { checkedInAt: true } });
    return new Map(rows.map((r) => [r.userId, { count: r._count._all, last: r._max.checkedInAt }]));
  }

  /** What each member still owes: open invoices minus completed payments. */
  private async balances(ids: string[]) {
    if (ids.length === 0) return new Map<string, number>();
    const rows = await this.prisma.client.$queryRaw<Array<{ userId: string; balance: number }>>(Prisma.sql`
      SELECT i."userId", SUM(GREATEST(i."totalCents" - COALESCE(p.paid, 0), 0))::int AS balance
      FROM "Invoice" i
      LEFT JOIN (SELECT "invoiceId", SUM("amountCents") AS paid FROM "Payment" WHERE status = 'COMPLETED' GROUP BY "invoiceId") p ON p."invoiceId" = i.id
      WHERE i.status = 'OPEN' AND i."userId" IN (${Prisma.join(ids)}) GROUP BY i."userId"`);
    return new Map(rows.map((r) => [r.userId, r.balance]));
  }

  private present(
    user: Prisma.UserGetPayload<{ select: typeof MEMBER_LIST_SELECT }>,
    expiringSoonDays: number,
    extra: { visits?: { count: number; last: Date | null }; balanceCents: number },
  ) {
    const { memberships, ...rest } = user;
    const current = pickCurrentMembership(memberships);
    const status = current ? computeMembershipStatus(current, { expiringSoonDays }) : ("NONE" as const);
    return {
      ...rest,
      currentMembership: current ? { ...current, computedStatus: status, daysRemaining: daysRemaining(current.endDate) } : null,
      membershipStatus: status,
      visitCount: extra.visits?.count ?? 0,
      lastVisitAt: extra.visits?.last ?? null,
      balanceCents: extra.balanceCents,
      // Kept for older callers that read the first membership row.
      memberships: memberships.slice(0, 1),
    };
  }

  // --- Detail --------------------------------------------------------------------------------

  async findOne(id: string, viewer: AuthenticatedUser) {
    const rules = await this.rules.get();
    const training = viewer.role === "ADMIN"; // reception does not need workout/PR data to run the front desk
    const user = await this.prisma.client.user.findFirst({
      where: { id, role: Role.MEMBER },
      select: {
        id: true,
        memberNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
        createdAt: true,
        adminNotes: isStaffWithNotes(viewer.role),
        assignedCoach: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        memberships: {
          orderBy: { startDate: "desc" },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            paymentStatus: true,
            priceCents: true,
            discountCents: true,
            discountNote: true,
            frozenFrom: true,
            frozenUntil: true,
            totalFrozenDays: true,
            renewedFromId: true,
            plan: { select: { id: true, name: true, planType: true, period: true, currency: true } },
          },
        },
        invoices: {
          orderBy: { issuedAt: "desc" },
          take: 20,
          include: { payments: true },
        },
        payments: {
          where: { status: "COMPLETED" },
          orderBy: { receivedAt: "desc" },
          take: 20,
          select: { id: true, amountCents: true, currency: true, method: true, receivedAt: true, reference: true, invoice: { select: { id: true, number: true } } },
        },
        visits: { orderBy: { checkedInAt: "desc" }, take: 15, select: { id: true, checkedInAt: true, method: true } },
        bookings: {
          where: { status: { in: ["BOOKED", "WAITLISTED"] }, class: { startTime: { gte: new Date() } } },
          orderBy: { class: { startTime: "asc" } },
          take: 10,
          select: { id: true, status: true, class: { select: { id: true, title: true, startTime: true, endTime: true } } },
        },
        attendance: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, status: true, checkedInAt: true, class: { select: { title: true, startTime: true } } },
        },
        ...(training
          ? {
              workoutResults: {
                orderBy: { completedAt: "desc" as const },
                take: 10,
                select: { id: true, completedAt: true, wod: { select: { title: true } }, exercise: { select: { name: true } } },
              },
              personalRecords: {
                orderBy: { updatedAt: "desc" as const },
                take: 20,
                select: { id: true, value: true, unit: true, achievedAt: true, verificationStatus: true, exercise: { select: { id: true, name: true } } },
              },
            }
          : {}),
      },
    });
    if (!user) throw new NotFoundException("Member not found");

    const [visitStats, visitCount] = await Promise.all([
      this.prisma.client.gymVisit.aggregate({ where: { userId: id }, _max: { checkedInAt: true } }),
      this.prisma.client.gymVisit.count({ where: { userId: id } }),
    ]);

    const now = new Date();
    const invoices = user.invoices.map((i) => {
      const paidCents = sumCompleted(i.payments);
      return { ...i, paidCents, balanceCents: balanceOf(i, paidCents), displayStatus: deriveInvoiceStatus(i, paidCents, now) };
    });

    const memberships = user.memberships.map((m) => ({ ...m, computedStatus: computeMembershipStatus(m, { expiringSoonDays: rules.expiringSoonDays }), daysRemaining: daysRemaining(m.endDate) }));
    const current = pickCurrentMembership(user.memberships);
    return {
      ...user,
      memberships,
      currentMembership: current ? memberships.find((m) => m.id === current.id) : null,
      invoices,
      balanceCents: invoices.reduce((n, i) => n + i.balanceCents, 0),
      visitCount,
      lastVisitAt: visitStats._max.checkedInAt,
    };
  }

  // --- Create / update -----------------------------------------------------------------------

  async create(dto: CreateMemberDto, viewer: AuthenticatedUser) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.client.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("An account with this email already exists");

    if (dto.assignedCoachId) await this.assertAssignable(dto.assignedCoachId, viewer);

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, this.config.get<number>("BCRYPT_SALT_ROUNDS")!);

    const user = await this.prisma.client.$transaction(async (tx) => {
      const memberNumber = await this.sequences.nextMemberNumber(tx);
      return tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: Role.MEMBER,
          memberNumber,
          // The person activates the account by choosing their own password the first time they sign in.
          mustChangePassword: true,
          assignedCoachId: dto.assignedCoachId,
          adminNotes: dto.adminNotes,
        },
        select: MEMBER_LIST_SELECT,
      });
    });

    await this.audit.record({ actorId: viewer.sub, action: "member.create", entityType: "User", entityId: user.id, metadata: { email, memberNumber: user.memberNumber } });
    const rules = await this.rules.get();
    return { member: this.present(user, rules.expiringSoonDays, { balanceCents: 0 }), temporaryPassword: tempPassword };
  }

  async update(id: string, dto: UpdateMemberDto, viewer: AuthenticatedUser) {
    const existing = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!existing) throw new NotFoundException("Member not found");

    if (dto.assignedCoachId !== undefined && viewer.role !== "ADMIN") {
      throw new ForbiddenException("Only the owner can assign a trainer");
    }
    if (dto.assignedCoachId) await this.assertAssignable(dto.assignedCoachId, viewer);

    const user = await this.prisma.client.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        adminNotes: dto.adminNotes,
        assignedCoachId: dto.assignedCoachId,
      },
      select: MEMBER_LIST_SELECT,
    });

    await this.audit.record({
      actorId: viewer.sub,
      action: "member.update",
      entityType: "User",
      entityId: id,
      metadata: dto.assignedCoachId !== undefined ? { assignedCoachFrom: existing.assignedCoachId, assignedCoachTo: dto.assignedCoachId } : undefined,
    });
    const rules = await this.rules.get();
    const [visits, balances] = await Promise.all([this.visitStats([id]), this.balances([id])]);
    return this.present(user, rules.expiringSoonDays, { visits: visits.get(id), balanceCents: balances.get(id) ?? 0 });
  }

  private async assertAssignable(coachId: string, viewer: AuthenticatedUser) {
    if (viewer.role !== "ADMIN") throw new ForbiddenException("Only the owner can assign a trainer");
    const coach = await this.prisma.client.coach.findUnique({ where: { id: coachId } });
    if (!coach || !coach.isActive) throw new NotFoundException("Trainer not found or not active");
  }

  async setStatus(id: string, dto: SetMemberStatusDto, actorId: string) {
    const existing = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!existing) throw new NotFoundException("Member not found");

    const user = await this.prisma.client.user.update({ where: { id }, data: { status: dto.status }, select: MEMBER_LIST_SELECT });

    await this.audit.record({ actorId, action: "member.status_change", entityType: "User", entityId: id, metadata: { from: existing.status, to: dto.status } });
    const rules = await this.rules.get();
    return this.present(user, rules.expiringSoonDays, { balanceCents: 0 });
  }

  /** Issues a fresh temporary password (shown once), requires the member to choose their own, and signs them out everywhere. */
  async resetPassword(id: string, actorId: string) {
    const existing = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!existing) throw new NotFoundException("Member not found");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, this.config.get<number>("BCRYPT_SALT_ROUNDS")!);

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } }),
      this.prisma.client.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await this.audit.record({ actorId, action: "member.password_reset_by_admin", entityType: "User", entityId: id });
    return { email: existing.email, temporaryPassword: tempPassword };
  }

  // --- QR card -----------------------------------------------------------------------------------

  /** The member's QR payload, for printing or showing at the desk. The member gets the same via /me/card. */
  async qrFor(id: string) {
    const user = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!user) throw new NotFoundException("Member not found");
    return { memberNumber: user.memberNumber, name: `${user.firstName} ${user.lastName}`, token: this.qr.issue(user.id, user.qrVersion) };
  }

  /** Invalidates the old QR (lost phone, shared screenshot) and returns the new one. */
  async reissueQr(id: string, actorId: string) {
    const user = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!user) throw new NotFoundException("Member not found");
    const updated = await this.prisma.client.user.update({ where: { id }, data: { qrVersion: { increment: 1 } } });
    await this.audit.record({ actorId, action: "member.qr_reissue", entityType: "User", entityId: id });
    return { memberNumber: updated.memberNumber, name: `${updated.firstName} ${updated.lastName}`, token: this.qr.issue(updated.id, updated.qrVersion) };
  }
}
