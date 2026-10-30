import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { gymPeriodStart } from "../../common/gym-time";
import { FinanceSummaryQueryDto } from "./dto/finance.dto";

export interface FinanceSummary {
  period: { from: string; to: string; groupBy: "day" | "week" | "month" };
  totals: {
    /** Money actually received in the period (COMPLETED payments). This is the revenue figure. */
    receivedCents: number;
    /** Invoices issued in the period. NOT revenue - shown separately so nobody confuses billed with received. */
    billedCents: number;
    expensesCents: number;
    /** received - expenses (cash basis). */
    netCents: number;
    /** Right now, across all open invoices: what members still owe / of which already overdue. Not limited to the period. */
    outstandingCents: number;
    overdueCents: number;
    paymentsCount: number;
    previousReceivedCents: number;
    receivedChangePercent: number | null;
  };
  series: Array<{ bucket: string; receivedCents: number; expensesCents: number }>;
  byMethod: Array<{ method: string; cents: number; count: number }>;
  byPlan: Array<{ planId: string | null; name: string; cents: number; count: number }>;
  expensesByCategory: Array<{ category: string; cents: number }>;
}

@Injectable()
export class FinanceReportsService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>("GYM_TIMEZONE")!;
  }

  /** Resolves the requested period; default is the gym's current calendar month up to now. */
  resolvePeriod(query: Pick<FinanceSummaryQueryDto, "from" | "to" | "groupBy">) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : gymPeriodStart("month", this.tz, now);
    const to = query.to ? new Date(query.to) : now;
    const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
    const groupBy = query.groupBy ?? (spanDays > 120 ? "month" : spanDays > 31 ? "week" : "day");
    return { from, to, groupBy };
  }

  async summary(query: FinanceSummaryQueryDto): Promise<FinanceSummary> {
    const { from, to, groupBy } = this.resolvePeriod(query);
    const db = this.prisma.client;

    const method = query.method ? Prisma.sql`AND p.method = ${query.method}::"PaymentMethod"` : Prisma.empty;
    const planPay = query.planId ? Prisma.sql`AND m."planId" = ${query.planId}` : Prisma.empty;
    const planInv = query.planId ? Prisma.sql`AND m."planId" = ${query.planId}` : Prisma.empty;

    const receivedWhere = Prisma.sql`p.status = 'COMPLETED' AND p."receivedAt" >= ${from} AND p."receivedAt" <= ${to} ${method} ${planPay}`;

    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);

    const [receivedSeries, expenseSeries, byMethod, byPlan, expCat, billed, outstanding, previous, expenseTotal] = await Promise.all([
      db.$queryRaw<Array<{ bucket: string; cents: number; n: number }>>(Prisma.sql`
        SELECT to_char(date_trunc(${groupBy}, p."receivedAt" AT TIME ZONE ${this.tz}), 'YYYY-MM-DD') AS bucket,
               SUM(p."amountCents")::int AS cents, COUNT(*)::int AS n
        FROM "Payment" p LEFT JOIN "Membership" m ON m.id = p."membershipId"
        WHERE ${receivedWhere} GROUP BY 1 ORDER BY 1`),
      // Expenses are not tied to a plan or payment method, so those filters do not apply to them.
      query.method || query.planId
        ? Promise.resolve([] as Array<{ bucket: string; cents: number }>)
        : db.$queryRaw<Array<{ bucket: string; cents: number }>>(Prisma.sql`
            SELECT to_char(date_trunc(${groupBy}, e."spentAt" AT TIME ZONE ${this.tz}), 'YYYY-MM-DD') AS bucket, SUM(e."amountCents")::int AS cents
            FROM "Expense" e WHERE e."voidedAt" IS NULL AND e."spentAt" >= ${from} AND e."spentAt" <= ${to} GROUP BY 1 ORDER BY 1`),
      db.$queryRaw<Array<{ method: string; cents: number; n: number }>>(Prisma.sql`
        SELECT p.method::text AS method, SUM(p."amountCents")::int AS cents, COUNT(*)::int AS n
        FROM "Payment" p LEFT JOIN "Membership" m ON m.id = p."membershipId"
        WHERE ${receivedWhere} GROUP BY 1 ORDER BY 2 DESC`),
      db.$queryRaw<Array<{ planId: string | null; name: string | null; cents: number; n: number }>>(Prisma.sql`
        SELECT mp.id AS "planId", mp.name AS name, SUM(p."amountCents")::int AS cents, COUNT(*)::int AS n
        FROM "Payment" p LEFT JOIN "Membership" m ON m.id = p."membershipId" LEFT JOIN "MembershipPlan" mp ON mp.id = m."planId"
        WHERE ${receivedWhere} GROUP BY mp.id, mp.name ORDER BY 3 DESC`),
      query.method || query.planId
        ? Promise.resolve([] as Array<{ category: string; cents: number }>)
        : db.$queryRaw<Array<{ category: string; cents: number }>>(Prisma.sql`
            SELECT e.category::text AS category, SUM(e."amountCents")::int AS cents FROM "Expense" e
            WHERE e."voidedAt" IS NULL AND e."spentAt" >= ${from} AND e."spentAt" <= ${to} GROUP BY 1 ORDER BY 2 DESC`),
      db.$queryRaw<Array<{ cents: number | null }>>(Prisma.sql`
        SELECT SUM(i."totalCents")::int AS cents FROM "Invoice" i LEFT JOIN "Membership" m ON m.id = i."membershipId"
        WHERE i.status = 'OPEN' AND i."issuedAt" >= ${from} AND i."issuedAt" <= ${to} ${planInv}`),
      db.$queryRaw<Array<{ outstanding: number | null; overdue: number | null }>>(Prisma.sql`
        SELECT SUM(GREATEST(i."totalCents" - COALESCE(pp.paid, 0), 0))::int AS outstanding,
               SUM(CASE WHEN i."dueDate" + interval '1 day' < now() THEN GREATEST(i."totalCents" - COALESCE(pp.paid, 0), 0) ELSE 0 END)::int AS overdue
        FROM "Invoice" i
        LEFT JOIN (SELECT "invoiceId", SUM("amountCents") AS paid FROM "Payment" WHERE status = 'COMPLETED' GROUP BY "invoiceId") pp ON pp."invoiceId" = i.id
        WHERE i.status = 'OPEN'`),
      db.$queryRaw<Array<{ cents: number | null }>>(Prisma.sql`
        SELECT SUM(p."amountCents")::int AS cents FROM "Payment" p LEFT JOIN "Membership" m ON m.id = p."membershipId"
        WHERE p.status = 'COMPLETED' AND p."receivedAt" >= ${prevFrom} AND p."receivedAt" < ${from} ${method} ${planPay}`),
      db.expense.aggregate({ where: { voidedAt: null, spentAt: { gte: from, lte: to } }, _sum: { amountCents: true } }),
    ]);

    const buckets = new Map<string, { receivedCents: number; expensesCents: number }>();
    for (const r of receivedSeries) buckets.set(r.bucket, { receivedCents: r.cents, expensesCents: 0 });
    for (const e of expenseSeries) {
      const b = buckets.get(e.bucket) ?? { receivedCents: 0, expensesCents: 0 };
      b.expensesCents = e.cents;
      buckets.set(e.bucket, b);
    }

    const receivedCents = receivedSeries.reduce((n, r) => n + r.cents, 0);
    const expensesCents = query.method || query.planId ? 0 : (expenseTotal._sum.amountCents ?? 0);
    const previousReceivedCents = previous[0]?.cents ?? 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString(), groupBy },
      totals: {
        receivedCents,
        billedCents: billed[0]?.cents ?? 0,
        expensesCents,
        netCents: receivedCents - expensesCents,
        outstandingCents: outstanding[0]?.outstanding ?? 0,
        overdueCents: outstanding[0]?.overdue ?? 0,
        paymentsCount: receivedSeries.reduce((n, r) => n + r.n, 0),
        previousReceivedCents,
        receivedChangePercent: previousReceivedCents > 0 ? Math.round(((receivedCents - previousReceivedCents) / previousReceivedCents) * 100) : null,
      },
      series: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, v]) => ({ bucket, ...v })),
      byMethod: byMethod.map((r) => ({ method: r.method, cents: r.cents, count: r.n })),
      byPlan: byPlan.map((r) => ({ planId: r.planId, name: r.name ?? "Not linked to a plan", cents: r.cents, count: r.n })),
      expensesByCategory: expCat,
    };
  }
}
