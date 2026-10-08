import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MembershipStatus, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { computeMembershipStatus } from "../../common/membership-status.util";
import { CreateMembershipPlanDto } from "./dto/create-membership-plan.dto";
import { UpdateMembershipPlanDto } from "./dto/update-membership-plan.dto";
import { CreateMembershipDto } from "./dto/create-membership.dto";
import { UpdateMembershipDto } from "./dto/update-membership.dto";
import { ListMembershipsQueryDto } from "./dto/list-memberships.query.dto";

const MEMBERSHIP_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  plan: { select: { id: true, name: true, durationDays: true, priceCents: true, currency: true } },
} as const;

const SEVEN_DAYS_MS = 7 * 86_400_000;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Plans -------------------------------------------------------------

  listPlans() {
    return this.prisma.client.membershipPlan.findMany({ orderBy: { createdAt: "asc" } });
  }

  async createPlan(dto: CreateMembershipPlanDto, actorId: string) {
    const plan = await this.prisma.client.membershipPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        durationDays: dto.durationDays,
        priceCents: dto.priceCents,
        currency: dto.currency ?? "EUR",
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.record({ actorId, action: "membership_plan.create", entityType: "MembershipPlan", entityId: plan.id });
    return plan;
  }

  async updatePlan(id: string, dto: UpdateMembershipPlanDto, actorId: string) {
    const existing = await this.prisma.client.membershipPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Membership plan not found");

    const plan = await this.prisma.client.membershipPlan.update({ where: { id }, data: dto });
    await this.audit.record({ actorId, action: "membership_plan.update", entityType: "MembershipPlan", entityId: id });
    return plan;
  }

  // --- Memberships ---------------------------------------------------------

  async list(query: ListMembershipsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const now = new Date();
    const soon = new Date(now.getTime() + SEVEN_DAYS_MS);

    const statusFilter: Prisma.MembershipWhereInput = (() => {
      switch (query.status) {
        case "CANCELLED":
          return { status: MembershipStatus.CANCELLED };
        case "EXPIRED":
          return { status: MembershipStatus.ACTIVE, endDate: { lt: now } };
        case "EXPIRING_SOON":
          return { status: MembershipStatus.ACTIVE, endDate: { gte: now, lte: soon } };
        case "ACTIVE":
          return { status: MembershipStatus.ACTIVE, endDate: { gt: soon } };
        default:
          return {};
      }
    })();

    const where: Prisma.MembershipWhereInput = {
      ...statusFilter,
      ...(query.search
        ? {
            user: {
              OR: [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.membership.findMany({
        where,
        include: MEMBERSHIP_INCLUDE,
        orderBy: { endDate: "asc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.membership.count({ where }),
    ]);

    return paginate(
      data.map((m) => ({ ...m, computedStatus: computeMembershipStatus(m) })),
      total,
      page,
      pageSize,
    );
  }

  async create(dto: CreateMembershipDto, actorId: string) {
    const [user, plan] = await Promise.all([
      this.prisma.client.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.client.membershipPlan.findUnique({ where: { id: dto.planId } }),
    ]);
    if (!user) throw new NotFoundException("Member not found");
    if (!plan) throw new NotFoundException("Membership plan not found");

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) throw new BadRequestException("endDate must be after startDate");

    const membership = await this.prisma.client.membership.create({
      data: {
        userId: dto.userId,
        planId: dto.planId,
        startDate,
        endDate,
        paymentStatus: dto.paymentStatus ?? "UNPAID",
      },
      include: MEMBERSHIP_INCLUDE,
    });

    await this.audit.record({
      actorId,
      action: "membership.create",
      entityType: "Membership",
      entityId: membership.id,
      metadata: { userId: dto.userId, planId: dto.planId },
    });

    return { ...membership, computedStatus: computeMembershipStatus(membership) };
  }

  async update(id: string, dto: UpdateMembershipDto, actorId: string) {
    const existing = await this.prisma.client.membership.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Membership not found");

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (endDate <= startDate) throw new BadRequestException("endDate must be after startDate");

    const membership = await this.prisma.client.membership.update({
      where: { id },
      data: { planId: dto.planId, startDate, endDate, paymentStatus: dto.paymentStatus },
      include: MEMBERSHIP_INCLUDE,
    });

    await this.audit.record({ actorId, action: "membership.update", entityType: "Membership", entityId: id });
    return { ...membership, computedStatus: computeMembershipStatus(membership) };
  }

  async cancel(id: string, actorId: string) {
    const existing = await this.prisma.client.membership.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Membership not found");

    const membership = await this.prisma.client.membership.update({
      where: { id },
      data: { status: MembershipStatus.CANCELLED, cancelledAt: new Date() },
      include: MEMBERSHIP_INCLUDE,
    });

    await this.audit.record({ actorId, action: "membership.cancel", entityType: "Membership", entityId: id });
    return { ...membership, computedStatus: computeMembershipStatus(membership) };
  }

  async findMineFor(userId: string) {
    const membership = await this.prisma.client.membership.findFirst({
      where: { userId },
      orderBy: { endDate: "desc" },
      include: MEMBERSHIP_INCLUDE,
    });
    if (!membership) return null;
    return { ...membership, computedStatus: computeMembershipStatus(membership) };
  }
}
