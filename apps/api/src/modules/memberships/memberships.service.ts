import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MembershipStatus, NotificationType, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { GymRulesService } from "../../common/gym-rules.service";
import { findCurrentMembership } from "../../common/current-membership";
import { paginate, skipTake } from "../../common/pagination.util";
import { computeMembershipStatus, daysRemaining } from "../../common/membership-status.util";
import { applyDiscount } from "../finance/finance.util";
import { InvoicesService } from "../finance/invoices.service";
import { PaymentsService } from "../finance/payments.service";
import { CreateMembershipPlanDto } from "./dto/create-membership-plan.dto";
import { UpdateMembershipPlanDto } from "./dto/update-membership-plan.dto";
import { CreateMembershipDto, InitialPaymentDto } from "./dto/create-membership.dto";
import { UpdateMembershipDto } from "./dto/update-membership.dto";
import { ListMembershipsQueryDto } from "./dto/list-memberships.query.dto";
import { FreezeMembershipDto, ListExpiringQueryDto, RenewMembershipDto, CreatePromotionDto, UpdatePromotionDto } from "./dto/memberships.dto";

const DAY_MS = 86_400_000;

const MEMBERSHIP_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, memberNumber: true } },
  plan: { select: { id: true, name: true, durationDays: true, priceCents: true, currency: true, planType: true, period: true } },
} satisfies Prisma.MembershipInclude;

interface NewMembershipInput {
  userId: string;
  plan: { id: string; name: string; durationDays: number; priceCents: number | null; currency: string };
  startDate: Date;
  endDate?: Date;
  priceCents?: number;
  promotion?: { name: string; percentOff: number | null; amountOffCents: number | null } | null;
  extraDiscountCents?: number;
  discountNote?: string;
  paymentStatus?: "PAID" | "UNPAID" | "PARTIAL";
  invoiceDueDate?: Date;
  initialPayment?: InitialPaymentDto;
  renewedFromId?: string;
  actorId: string;
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: GymRulesService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
  ) {}

  /** Adds the derived fields every client needs: status (with Frozen), days remaining. */
  private async serialize<T extends { status: "ACTIVE" | "CANCELLED"; endDate: Date; frozenFrom: Date | null; frozenUntil: Date | null }>(membership: T) {
    const { expiringSoonDays } = await this.rules.get();
    return {
      ...membership,
      computedStatus: computeMembershipStatus(membership, { expiringSoonDays }),
      daysRemaining: daysRemaining(membership.endDate),
    };
  }

  // --- Plans -------------------------------------------------------------------

  listPlans() {
    return this.prisma.client.membershipPlan.findMany({ orderBy: [{ isActive: "desc" }, { durationDays: "asc" }, { createdAt: "asc" }] });
  }

  async createPlan(dto: CreateMembershipPlanDto, actorId: string) {
    const plan = await this.prisma.client.membershipPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        durationDays: dto.durationDays,
        planType: dto.planType ?? "COMBINED",
        period: dto.period ?? "CUSTOM",
        services: dto.services ?? [],
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
    // Changing a price does not touch memberships already sold - they keep the price they were sold at.
    await this.audit.record({
      actorId,
      action: "membership_plan.update",
      entityType: "MembershipPlan",
      entityId: id,
      metadata: existing.priceCents !== plan.priceCents ? { priceFrom: existing.priceCents, priceTo: plan.priceCents } : undefined,
    });
    return plan;
  }

  // --- Promotions (discounts the staff can pick) -----------------------------------

  async listPromotions(activeOnly: boolean) {
    const now = new Date();
    return this.prisma.client.promotion.findMany({
      where: activeOnly ? { isActive: true, AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }, { OR: [{ validTo: null }, { validTo: { gte: now } }] }] } : {},
      orderBy: { createdAt: "desc" },
    });
  }

  async createPromotion(dto: CreatePromotionDto, actorId: string) {
    if ((dto.percentOff == null) === (dto.amountOffCents == null)) {
      throw new BadRequestException("Set either a percentage or a fixed amount off, not both and not neither");
    }
    const promotion = await this.prisma.client.promotion.create({
      data: {
        name: dto.name,
        percentOff: dto.percentOff,
        amountOffCents: dto.amountOffCents,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.record({ actorId, action: "promotion.create", entityType: "Promotion", entityId: promotion.id });
    return promotion;
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto, actorId: string) {
    const existing = await this.prisma.client.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Promotion not found");
    const promotion = await this.prisma.client.promotion.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive, validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined, validTo: dto.validTo ? new Date(dto.validTo) : undefined },
    });
    await this.audit.record({ actorId, action: "promotion.update", entityType: "Promotion", entityId: id });
    return promotion;
  }

  private async resolvePromotion(promotionId?: string) {
    if (!promotionId) return null;
    const promotion = await this.prisma.client.promotion.findUnique({ where: { id: promotionId } });
    if (!promotion) throw new NotFoundException("Promotion not found");
    const now = new Date();
    if (!promotion.isActive || (promotion.validFrom && promotion.validFrom > now) || (promotion.validTo && promotion.validTo < now)) {
      throw new BadRequestException("That promotion is not currently valid");
    }
    return promotion;
  }

  // --- Listing ---------------------------------------------------------------------

  async list(query: ListMembershipsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { expiringSoonDays } = await this.rules.get();
    const now = new Date();
    const soon = new Date(now.getTime() + expiringSoonDays * DAY_MS);
    const notFrozen: Prisma.MembershipWhereInput = { OR: [{ frozenFrom: null }, { frozenUntil: null }, { frozenFrom: { gt: now } }, { frozenUntil: { lte: now } }] };

    const statusFilter: Prisma.MembershipWhereInput = (() => {
      switch (query.status) {
        case "CANCELLED":
          return { status: MembershipStatus.CANCELLED };
        case "FROZEN":
          return { status: MembershipStatus.ACTIVE, frozenFrom: { lte: now }, frozenUntil: { gt: now } };
        case "EXPIRED":
          return { status: MembershipStatus.ACTIVE, endDate: { lt: now } };
        case "EXPIRING_SOON":
          return { AND: [{ status: MembershipStatus.ACTIVE, endDate: { gte: now, lte: soon } }, notFrozen] };
        case "ACTIVE":
          return { AND: [{ status: MembershipStatus.ACTIVE, endDate: { gt: soon } }, notFrozen] };
        default:
          return {};
      }
    })();

    const where: Prisma.MembershipWhereInput = {
      AND: [
        statusFilter,
        query.userId ? { userId: query.userId } : {},
        query.search
          ? {
              user: {
                OR: [
                  { firstName: { contains: query.search, mode: "insensitive" } },
                  { lastName: { contains: query.search, mode: "insensitive" } },
                  { email: { contains: query.search, mode: "insensitive" } },
                  { memberNumber: { contains: query.search, mode: "insensitive" } },
                ],
              },
            }
          : {},
      ],
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.membership.findMany({ where, include: MEMBERSHIP_INCLUDE, orderBy: { endDate: query.userId ? "desc" : "asc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.membership.count({ where }),
    ]);

    return paginate(await Promise.all(data.map((m) => this.serialize(m))), total, page, pageSize);
  }

  /** Active memberships ending soon, with contact details and anything still owed - the renewal call list. */
  async expiring(query: ListExpiringQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const rules = await this.rules.get();
    const days = query.days ?? rules.expiringSoonDays;
    const now = new Date();
    const where: Prisma.MembershipWhereInput = { status: "ACTIVE", endDate: { gte: now, lte: new Date(now.getTime() + days * DAY_MS) } };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.membership.findMany({
        where,
        include: { ...MEMBERSHIP_INCLUDE, user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, memberNumber: true } } },
        orderBy: { endDate: "asc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.membership.count({ where }),
    ]);

    // Has the member already renewed? Then there is nothing to chase.
    const renewed = await this.prisma.client.membership.findMany({ where: { renewedFromId: { in: rows.map((r) => r.id) } }, select: { renewedFromId: true } });
    const renewedIds = new Set(renewed.map((r) => r.renewedFromId));
    const data = await Promise.all(rows.map(async (m) => ({ ...(await this.serialize(m)), alreadyRenewed: renewedIds.has(m.id) })));
    return { ...paginate(data, total, page, pageSize), days };
  }

  // --- Assign / renew --------------------------------------------------------------

  async create(dto: CreateMembershipDto, actorId: string) {
    const [user, plan, promotion] = await Promise.all([
      this.prisma.client.user.findFirst({ where: { id: dto.userId, role: "MEMBER" } }),
      this.prisma.client.membershipPlan.findUnique({ where: { id: dto.planId } }),
      this.resolvePromotion(dto.promotionId),
    ]);
    if (!user) throw new NotFoundException("Member not found");
    if (!plan) throw new NotFoundException("Membership plan not found");

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date(startDate.getTime() + plan.durationDays * DAY_MS);
    if (endDate <= startDate) throw new BadRequestException("endDate must be after startDate");

    const membership = await this.createInTransaction({
      userId: dto.userId,
      plan,
      startDate,
      endDate,
      priceCents: dto.priceCents,
      promotion,
      extraDiscountCents: dto.discountCents,
      discountNote: dto.discountNote,
      paymentStatus: dto.paymentStatus,
      invoiceDueDate: dto.invoiceDueDate ? new Date(dto.invoiceDueDate) : undefined,
      initialPayment: dto.initialPayment,
      actorId,
    });
    return membership;
  }

  /** Renewal: a NEW membership (so history is kept) that starts when the current one ends, linked to it. */
  async renew(id: string, dto: RenewMembershipDto, actorId: string) {
    const existing = await this.prisma.client.membership.findUnique({ where: { id }, include: { plan: true } });
    if (!existing) throw new NotFoundException("Membership not found");
    if (existing.status === "CANCELLED") throw new BadRequestException("A cancelled membership cannot be renewed. Assign a new one instead.");

    const already = await this.prisma.client.membership.findFirst({ where: { renewedFromId: id, status: "ACTIVE" } });
    if (already) throw new ConflictException("This membership has already been renewed");

    const plan = dto.planId ? await this.prisma.client.membershipPlan.findUnique({ where: { id: dto.planId } }) : existing.plan;
    if (!plan) throw new NotFoundException("Membership plan not found");
    const promotion = await this.resolvePromotion(dto.promotionId);

    const now = new Date();
    const startDate = dto.startDate ? new Date(dto.startDate) : existing.endDate > now ? existing.endDate : now;
    const created = await this.createInTransaction({
      userId: existing.userId,
      plan,
      startDate,
      priceCents: dto.priceCents,
      promotion,
      extraDiscountCents: dto.discountCents,
      discountNote: dto.discountNote,
      initialPayment: dto.initialPayment,
      renewedFromId: id,
      actorId,
    });
    await this.audit.record({ actorId, action: "membership.renew", entityType: "Membership", entityId: created.id, metadata: { renewedFrom: id } });
    return created;
  }

  /**
   * Creates the membership and, when a price is known, its invoice and an optional first payment, in ONE transaction.
   * The membership's payment status is then derived from the money, not typed in.
   */
  private async createInTransaction(input: NewMembershipInput) {
    const rules = await this.rules.get();
    const endDate = input.endDate ?? new Date(input.startDate.getTime() + input.plan.durationDays * DAY_MS);
    const price = input.priceCents ?? input.plan.priceCents ?? null;
    const discount = price != null ? applyDiscount(price, { percentOff: input.promotion?.percentOff, amountOffCents: input.promotion?.amountOffCents, extraCents: input.extraDiscountCents }) : 0;
    const note = input.discountNote ?? (input.promotion && discount > 0 ? input.promotion.name : undefined);

    if (input.initialPayment && (price == null || price - discount <= 0)) {
      throw new BadRequestException("There is nothing to pay on this membership. Set a price before recording a payment.");
    }

    const { membership, payment } = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.membership.create({
        data: {
          userId: input.userId,
          planId: input.plan.id,
          startDate: input.startDate,
          endDate,
          priceCents: price,
          discountCents: discount,
          discountNote: note,
          renewedFromId: input.renewedFromId,
          paymentStatus: input.paymentStatus ?? "UNPAID",
        },
      });

      let paymentRow: Awaited<ReturnType<PaymentsService["recordWithin"]>> | null = null;
      if (price != null && price > 0) {
        const dueDate = input.invoiceDueDate ?? new Date(input.startDate.getTime() + rules.invoiceDueDays * DAY_MS);
        const invoice = await this.invoices.issue(tx, {
          userId: input.userId,
          membershipId: created.id,
          description: `${input.plan.name} membership`,
          lines: [{ description: `${input.plan.name} (${input.startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)})`, amountCents: price }],
          discountCents: discount,
          dueDate,
          notes: note ? `Discount: ${note}` : undefined,
          actorId: input.actorId,
          currency: input.plan.currency,
        });
        if (input.initialPayment) {
          paymentRow = await this.payments.recordWithin(tx, { userId: input.userId, invoiceId: invoice.id, ...input.initialPayment }, input.actorId);
        }
        await this.invoices.refreshMembershipPaymentStatus(tx, created.id);
      }
      const full = await tx.membership.findUniqueOrThrow({ where: { id: created.id }, include: MEMBERSHIP_INCLUDE });
      return { membership: full, payment: paymentRow };
    });

    await this.audit.record({
      actorId: input.actorId,
      action: "membership.create",
      entityType: "Membership",
      entityId: membership.id,
      metadata: { userId: input.userId, planId: input.plan.id, priceCents: price, discountCents: discount },
    });
    if (payment) await this.payments.auditRecorded(payment, input.actorId);

    const invoice = await this.prisma.client.invoice.findFirst({ where: { membershipId: membership.id, status: "OPEN" }, orderBy: { issuedAt: "desc" } });
    return { ...(await this.serialize(membership)), invoiceId: invoice?.id ?? null, invoiceNumber: invoice?.number ?? null };
  }

  // --- Edit / cancel -----------------------------------------------------------------

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

    await this.audit.record({
      actorId,
      action: "membership.update",
      entityType: "Membership",
      entityId: id,
      metadata: { endDateFrom: existing.endDate, endDateTo: endDate },
    });
    return this.serialize(membership);
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
    return this.serialize(membership);
  }

  // --- Freeze ------------------------------------------------------------------------

  /**
   * Freezes a membership for a period. The end date moves out by the frozen days so the member does not lose time,
   * and bookings / entry are refused while it is frozen. The gym's maximum (if configured) caps the TOTAL frozen
   * days per membership; no limit is assumed when none has been set.
   */
  async freeze(id: string, dto: FreezeMembershipDto, actorId: string) {
    const existing = await this.prisma.client.membership.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Membership not found");
    const rules = await this.rules.get();
    const now = new Date();

    if (existing.status === "CANCELLED") throw new BadRequestException("A cancelled membership cannot be frozen");
    if (existing.endDate < now) throw new BadRequestException("An expired membership cannot be frozen. Renew it instead.");
    if (existing.frozenUntil && existing.frozenUntil > now) throw new ConflictException("This membership is already frozen (or has a freeze scheduled). End it first to change it.");

    const from = dto.from ? new Date(dto.from) : now;
    const until = new Date(dto.until);
    if (from.getTime() < now.getTime() - 5 * 60_000) throw new BadRequestException("A freeze cannot start in the past");
    if (until <= from) throw new BadRequestException("The freeze must end after it starts");

    const days = Math.ceil((until.getTime() - from.getTime()) / DAY_MS);
    if (rules.maxFreezeDays != null && existing.totalFrozenDays + days > rules.maxFreezeDays) {
      throw new BadRequestException(`That would exceed the maximum of ${rules.maxFreezeDays} frozen days for one membership (already used: ${existing.totalFrozenDays}).`);
    }

    const membership = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id },
        data: { frozenFrom: from, frozenUntil: until, endDate: new Date(existing.endDate.getTime() + days * DAY_MS), totalFrozenDays: { increment: days } },
        include: MEMBERSHIP_INCLUDE,
      });
      await tx.notification.create({
        data: {
          userId: existing.userId,
          type: NotificationType.MEMBERSHIP_FROZEN,
          title: "Membership frozen",
          body: `Your membership is frozen from ${from.toISOString().slice(0, 10)} to ${until.toISOString().slice(0, 10)}. Your end date moved ${days} day${days === 1 ? "" : "s"} later.`,
          data: { membershipId: id },
        },
      });
      return updated;
    });

    await this.audit.record({ actorId, action: "membership.freeze", entityType: "Membership", entityId: id, metadata: { from, until, days, reason: dto.reason } });
    return this.serialize(membership);
  }

  /** Ends a freeze early and takes back the days that were added but not used. */
  async unfreeze(id: string, reason: string | undefined, actorId: string) {
    const existing = await this.prisma.client.membership.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Membership not found");
    const now = new Date();
    if (!existing.frozenFrom || !existing.frozenUntil || existing.frozenUntil <= now) throw new BadRequestException("This membership is not frozen");

    const notStarted = existing.frozenFrom > now;
    const unusedMs = existing.frozenUntil.getTime() - (notStarted ? existing.frozenFrom.getTime() : now.getTime());
    const unusedDays = Math.min(existing.totalFrozenDays, Math.max(0, Math.round(unusedMs / DAY_MS)));

    const membership = await this.prisma.client.membership.update({
      where: { id },
      data: {
        frozenFrom: notStarted ? null : existing.frozenFrom,
        frozenUntil: notStarted ? null : now,
        endDate: new Date(existing.endDate.getTime() - unusedDays * DAY_MS),
        totalFrozenDays: { decrement: unusedDays },
      },
      include: MEMBERSHIP_INCLUDE,
    });
    await this.audit.record({ actorId, action: "membership.unfreeze", entityType: "Membership", entityId: id, metadata: { daysReturned: unusedDays, reason } });
    return this.serialize(membership);
  }

  // --- Member's own view ---------------------------------------------------------------

  /** The member's current membership (null if none) with status, days remaining and price info. */
  async findMineFor(userId: string) {
    const membership = await findCurrentMembership(this.prisma, userId, MEMBERSHIP_INCLUDE);
    if (!membership) return null;
    return this.serialize(membership);
  }

  /** All of the member's previous and current packages, newest first. */
  async historyFor(userId: string) {
    const rows = await this.prisma.client.membership.findMany({ where: { userId }, include: MEMBERSHIP_INCLUDE, orderBy: { startDate: "desc" } });
    return Promise.all(rows.map((m) => this.serialize(m)));
  }
}
