import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { GymRulesService } from "../../common/gym-rules.service";
import { SequencesService } from "../../common/sequences.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { balanceOf, deriveInvoiceStatus, sumCompleted } from "./finance.util";
import { CreateInvoiceDto, ListInvoicesQueryDto } from "./dto/finance.dto";

type Tx = Prisma.TransactionClient;

export const INVOICE_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, memberNumber: true } },
  membership: { select: { id: true, startDate: true, endDate: true, plan: { select: { id: true, name: true } } } },
  lines: true,
  payments: { orderBy: { receivedAt: "desc" as const } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

const DAY_MS = 86_400_000;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: GymRulesService,
    private readonly sequences: SequencesService,
  ) {}

  /** Adds the derived money fields. paid/balance/status are computed from the payments, never stored. */
  present(invoice: InvoiceWithRelations, now: Date = new Date()) {
    const paidCents = sumCompleted(invoice.payments);
    return {
      ...invoice,
      paidCents,
      balanceCents: balanceOf(invoice, paidCents),
      displayStatus: deriveInvoiceStatus(invoice, paidCents, now),
    };
  }

  // --- Reading ---------------------------------------------------------------

  async list(query: ListInvoicesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const now = new Date();

    const where: Prisma.InvoiceWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? { issuedAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: "insensitive" } },
              { user: { firstName: { contains: query.search, mode: "insensitive" } } },
              { user: { lastName: { contains: query.search, mode: "insensitive" } } },
              { user: { memberNumber: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    if (query.status) {
      where.id = { in: await this.idsByDerivedStatus(query.status, now) };
    }

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.invoice.findMany({ where, include: INVOICE_INCLUDE, orderBy: { issuedAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.invoice.count({ where }),
    ]);
    return paginate(rows.map((r) => this.present(r, now)), total, page, pageSize);
  }

  async findOne(id: string) {
    const invoice = await this.prisma.client.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.present(invoice);
  }

  /** A member's own invoices (voided ones are hidden from them). */
  async mine(userId: string, query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.InvoiceWhereInput = { userId, status: "OPEN" };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.invoice.findMany({ where, include: INVOICE_INCLUDE, orderBy: { issuedAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.invoice.count({ where }),
    ]);
    return paginate(rows.map((r) => this.present(r)), total, page, pageSize);
  }

  async mineOne(userId: string, id: string) {
    const invoice = await this.prisma.client.invoice.findFirst({ where: { id, userId, status: "OPEN" }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.present(invoice);
  }

  /** What the member owes and when the next payment is due - for the "My Payments" screen. */
  async billingSummary(userId: string) {
    const invoices = await this.prisma.client.invoice.findMany({ where: { userId, status: "OPEN" }, include: INVOICE_INCLUDE });
    const now = new Date();
    const presented = invoices.map((i) => this.present(i, now));
    const open = presented.filter((i) => i.balanceCents > 0).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const received = await this.prisma.client.payment.aggregate({ where: { userId, status: "COMPLETED" }, _sum: { amountCents: true } });
    return {
      currency: invoices[0]?.currency ?? "EUR",
      balanceCents: open.reduce((n, i) => n + i.balanceCents, 0),
      overdueCents: open.filter((i) => i.displayStatus === "OVERDUE").reduce((n, i) => n + i.balanceCents, 0),
      totalPaidCents: received._sum.amountCents ?? 0,
      openInvoiceCount: open.length,
      nextPayment: open[0] ? { invoiceId: open[0].id, number: open[0].number, dueDate: open[0].dueDate, balanceCents: open[0].balanceCents, status: open[0].displayStatus } : null,
    };
  }

  // --- Writing ---------------------------------------------------------------

  /** A manual invoice for anything that is not a membership fee (e.g. a locker, a one-off class). */
  async createManual(dto: CreateInvoiceDto, actorId: string) {
    const member = await this.prisma.client.user.findFirst({ where: { id: dto.userId, role: "MEMBER" } });
    if (!member) throw new NotFoundException("Member not found");
    if (dto.membershipId) {
      const m = await this.prisma.client.membership.findFirst({ where: { id: dto.membershipId, userId: dto.userId } });
      if (!m) throw new BadRequestException("That membership does not belong to this member");
    }
    const subtotal = dto.lines.reduce((n, l) => n + l.amountCents, 0);
    const discount = dto.discountCents ?? 0;
    if (discount > subtotal) throw new BadRequestException("The discount cannot exceed the invoice amount");

    const rules = await this.rules.get();
    const issuedAt = new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(issuedAt.getTime() + rules.invoiceDueDays * DAY_MS);

    const invoice = await this.prisma.client.$transaction((tx) =>
      this.issue(tx, {
        userId: dto.userId,
        membershipId: dto.membershipId,
        description: dto.description,
        lines: dto.lines,
        discountCents: discount,
        dueDate,
        notes: dto.notes,
        actorId,
      }),
    );
    await this.audit.record({ actorId, action: "invoice.create", entityType: "Invoice", entityId: invoice.id, metadata: { number: invoice.number, totalCents: invoice.totalCents } });
    return this.findOne(invoice.id);
  }

  /** Creates the invoice row, its lines and its number inside the caller's transaction. */
  async issue(
    tx: Tx,
    input: {
      userId: string;
      membershipId?: string | null;
      description: string;
      lines: Array<{ description: string; amountCents: number }>;
      discountCents: number;
      dueDate: Date;
      notes?: string | null;
      actorId: string;
      currency?: string;
    },
  ) {
    const subtotal = input.lines.reduce((n, l) => n + l.amountCents, 0);
    const number = await this.sequences.nextInvoiceNumber(tx);
    return tx.invoice.create({
      data: {
        number,
        userId: input.userId,
        membershipId: input.membershipId ?? null,
        description: input.description,
        subtotalCents: subtotal,
        discountCents: input.discountCents,
        totalCents: subtotal - input.discountCents,
        currency: input.currency ?? "EUR",
        dueDate: input.dueDate,
        notes: input.notes ?? null,
        createdById: input.actorId,
        lines: { create: input.lines.map((l) => ({ description: l.description, amountCents: l.amountCents })) },
      },
    });
  }

  /** Voiding keeps the invoice (and its number) for the record. It is refused while money received against it stands. */
  async voidInvoice(id: string, reason: string, actorId: string) {
    const invoice = await this.prisma.client.invoice.findUnique({ where: { id }, include: { payments: true } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status === "VOID") throw new BadRequestException("This invoice is already void");
    if (sumCompleted(invoice.payments) > 0) {
      throw new BadRequestException("Money has been received against this invoice. Void those payments first, then void the invoice.");
    }
    await this.prisma.client.invoice.update({ where: { id }, data: { status: "VOID", voidedAt: new Date(), voidedById: actorId, voidReason: reason } });
    if (invoice.membershipId) await this.refreshMembershipPaymentStatus(this.prisma.client, invoice.membershipId);
    await this.audit.record({ actorId, action: "invoice.void", entityType: "Invoice", entityId: id, metadata: { number: invoice.number, reason } });
    return this.findOne(id);
  }

  /**
   * Keeps Membership.paymentStatus in step with the money: derived from the membership's non-void invoices.
   * A membership with no invoices keeps whatever staff set by hand.
   */
  async refreshMembershipPaymentStatus(db: Tx | PrismaService["client"], membershipId: string) {
    const invoices = await db.invoice.findMany({ where: { membershipId, status: "OPEN" }, include: { payments: true } });
    if (invoices.length === 0) return;
    const total = invoices.reduce((n, i) => n + i.totalCents, 0);
    const paid = invoices.reduce((n, i) => n + Math.min(sumCompleted(i.payments), i.totalCents), 0);
    const paymentStatus = paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
    await db.membership.update({ where: { id: membershipId }, data: { paymentStatus } });
  }

  // --- Derived-status filtering ----------------------------------------------

  private async idsByDerivedStatus(status: NonNullable<ListInvoicesQueryDto["status"]>, now: Date): Promise<string[]> {
    const paid = Prisma.sql`COALESCE(p.paid, 0)`;
    const overdue = Prisma.sql`i."dueDate" + interval '1 day' < ${now}`;
    const cond: Prisma.Sql = {
      VOID: Prisma.sql`i.status = 'VOID'`,
      PAID: Prisma.sql`i.status = 'OPEN' AND ${paid} >= i."totalCents"`,
      OUTSTANDING: Prisma.sql`i.status = 'OPEN' AND ${paid} < i."totalCents"`,
      OVERDUE: Prisma.sql`i.status = 'OPEN' AND ${paid} < i."totalCents" AND ${overdue}`,
      PARTIAL: Prisma.sql`i.status = 'OPEN' AND ${paid} > 0 AND ${paid} < i."totalCents" AND NOT (${overdue})`,
      PENDING: Prisma.sql`i.status = 'OPEN' AND ${paid} = 0 AND i."totalCents" > 0 AND NOT (${overdue})`,
    }[status];
    const rows = await this.prisma.client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT i.id FROM "Invoice" i
      LEFT JOIN (SELECT "invoiceId", SUM("amountCents")::int AS paid FROM "Payment" WHERE status = 'COMPLETED' GROUP BY "invoiceId") p
        ON p."invoiceId" = i.id
      WHERE ${cond}`);
    return rows.map((r) => r.id);
  }
}
