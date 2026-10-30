import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { sumCompleted, formatMoney } from "./finance.util";
import { InvoicesService } from "./invoices.service";
import { CorrectPaymentDto, ListPaymentsQueryDto, RecordPaymentDto } from "./dto/finance.dto";

const PAYMENT_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
  invoice: { select: { id: true, number: true, totalCents: true } },
  membership: { select: { id: true, plan: { select: { id: true, name: true } } } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
  ) {}

  async list(query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PaymentWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.planId ? { membership: { planId: query.planId } } : {}),
      ...(query.from || query.to
        ? { receivedAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: "insensitive" } },
              { invoice: { number: { contains: query.search, mode: "insensitive" } } },
              { user: { firstName: { contains: query.search, mode: "insensitive" } } },
              { user: { lastName: { contains: query.search, mode: "insensitive" } } },
              { user: { memberNumber: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [data, total, received] = await this.prisma.client.$transaction([
      this.prisma.client.payment.findMany({ where, include: PAYMENT_INCLUDE, orderBy: { receivedAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.payment.count({ where }),
      // Revenue for exactly the filtered set: COMPLETED payments only.
      this.prisma.client.payment.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { amountCents: true } }),
    ]);
    return { ...paginate(data, total, page, pageSize), totals: { receivedCents: received._sum.amountCents ?? 0 } };
  }

  async mine(userId: string, query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PaymentWhereInput = { userId, status: "COMPLETED" };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.payment.findMany({ where, include: PAYMENT_INCLUDE, orderBy: { receivedAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.payment.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  /**
   * Records money received. The payment is linked to the member, the invoice and (through it) the membership,
   * and the membership's payment status is updated in the same transaction. The invoice row is locked first, so two
   * staff members paying the same invoice at the same moment can never together exceed its balance.
   */
  async record(dto: RecordPaymentDto, actorId: string) {
    const member = await this.prisma.client.user.findFirst({ where: { id: dto.userId, role: "MEMBER" } });
    if (!member) throw new NotFoundException("Member not found");

    const payment = await this.prisma.client.$transaction((tx) => this.recordWithin(tx, dto, actorId));
    await this.auditRecorded(payment, actorId);
    return payment;
  }

  /** The body of `record`, usable inside a caller's transaction (e.g. assigning a membership with a first payment). */
  async recordWithin(tx: Prisma.TransactionClient, dto: RecordPaymentDto, actorId: string) {
    let invoiceId = dto.invoiceId;
    if (!invoiceId) {
      if (!dto.membershipId) throw new BadRequestException("Choose the invoice (or the membership) this payment is for");
      // Apply to the oldest invoice of that membership that still has a balance.
      const candidates = await tx.invoice.findMany({
        where: { membershipId: dto.membershipId, userId: dto.userId, status: "OPEN" },
        include: { payments: true },
        orderBy: { issuedAt: "asc" },
      });
      const target = candidates.find((i) => i.totalCents - sumCompleted(i.payments) > 0);
      if (!target) throw new BadRequestException("This membership has no unpaid invoice. Issue an invoice first.");
      invoiceId = target.id;
    }

    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.userId !== dto.userId) throw new BadRequestException("That invoice belongs to a different member");
    if (invoice.status === "VOID") throw new BadRequestException("That invoice is void");
    if (dto.membershipId && invoice.membershipId && invoice.membershipId !== dto.membershipId) {
      throw new BadRequestException("That invoice belongs to a different membership");
    }

    const balance = invoice.totalCents - sumCompleted(invoice.payments);
    if (balance <= 0) throw new BadRequestException("This invoice is already fully paid");
    if (dto.amountCents > balance) {
      throw new BadRequestException(`The amount is more than the outstanding balance (${formatMoney(balance, invoice.currency)}).`);
    }

    const created = await tx.payment.create({
      data: {
        userId: dto.userId,
        invoiceId: invoice.id,
        membershipId: invoice.membershipId,
        amountCents: dto.amountCents,
        currency: invoice.currency,
        method: dto.method,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
        reference: dto.reference,
        notes: dto.notes,
        recordedById: actorId,
      },
      include: PAYMENT_INCLUDE,
    });

    if (invoice.membershipId) await this.invoices.refreshMembershipPaymentStatus(tx, invoice.membershipId);

    await tx.notification.create({
      data: {
        userId: dto.userId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Payment received",
        body: `We received ${formatMoney(dto.amountCents, invoice.currency)} for invoice ${invoice.number}.`,
        data: { invoiceId: invoice.id, paymentId: created.id },
      },
    });
    return created;
  }

  async auditRecorded(payment: { id: string; userId: string; invoiceId: string | null; amountCents: number; method: string }, actorId: string) {
    await this.audit.record({
      actorId,
      action: "payment.record",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { userId: payment.userId, invoiceId: payment.invoiceId, amountCents: payment.amountCents, method: payment.method },
    });
  }

  /** Cancels a payment. It stays on record as VOIDED (who, when, why) and stops counting as revenue. */
  async voidPayment(id: string, reason: string, actorId: string) {
    const existing = await this.prisma.client.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Payment not found");
    if (existing.status === "VOIDED") throw new BadRequestException("This payment is already void");

    const payment = await this.prisma.client.$transaction(async (tx) => {
      if (existing.invoiceId) await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${existing.invoiceId} FOR UPDATE`;
      const updated = await tx.payment.update({
        where: { id },
        data: { status: "VOIDED", voidedAt: new Date(), voidedById: actorId, voidReason: reason },
        include: PAYMENT_INCLUDE,
      });
      if (existing.membershipId) await this.invoices.refreshMembershipPaymentStatus(tx, existing.membershipId);
      return updated;
    });

    await this.audit.record({
      actorId,
      action: "payment.void",
      entityType: "Payment",
      entityId: id,
      metadata: { amountCents: existing.amountCents, method: existing.method, reason },
    });
    return payment;
  }

  /** Corrects a recorded payment (typo in amount, wrong method...). The before/after values go to the audit log. */
  async correct(id: string, dto: CorrectPaymentDto, actorId: string) {
    const existing = await this.prisma.client.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Payment not found");
    if (existing.status === "VOIDED") throw new BadRequestException("A voided payment cannot be corrected");

    const payment = await this.prisma.client.$transaction(async (tx) => {
      if (existing.invoiceId) {
        await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${existing.invoiceId} FOR UPDATE`;
        if (dto.amountCents !== undefined) {
          const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: existing.invoiceId }, include: { payments: true } });
          const others = sumCompleted(invoice.payments) - existing.amountCents;
          if (others + dto.amountCents > invoice.totalCents) {
            throw new BadRequestException(`That amount would exceed the invoice total (${formatMoney(invoice.totalCents, invoice.currency)}).`);
          }
        }
      }
      const updated = await tx.payment.update({
        where: { id },
        data: {
          amountCents: dto.amountCents,
          method: dto.method,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
          reference: dto.reference,
          notes: dto.notes,
        },
        include: PAYMENT_INCLUDE,
      });
      if (existing.membershipId) await this.invoices.refreshMembershipPaymentStatus(tx, existing.membershipId);
      return updated;
    });

    await this.audit.record({
      actorId,
      action: "payment.correct",
      entityType: "Payment",
      entityId: id,
      metadata: {
        reason: dto.reason,
        before: { amountCents: existing.amountCents, method: existing.method, receivedAt: existing.receivedAt, reference: existing.reference },
        after: { amountCents: payment.amountCents, method: payment.method, receivedAt: payment.receivedAt, reference: payment.reference },
      },
    });
    return payment;
  }
}
