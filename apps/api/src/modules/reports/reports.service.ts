import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { GymRulesService } from "../../common/gym-rules.service";
import { gymDayStart, gymPeriodStart } from "../../common/gym-time";
import { frozenNow as frozenWhere, runningNow } from "../../common/membership-where";
import { paginate, skipTake } from "../../common/pagination.util";
import { FinanceReportsService } from "../finance/finance-reports.service";
import { MembershipsService } from "../memberships/memberships.service";

const DAY_MS = 86_400_000;

export interface MonthlyGrowth {
  month: string; // YYYY-MM
  newMembers: number; // accounts registered
  newMemberships: number; // first-time memberships sold
  renewals: number; // memberships that continue a previous one
  lost: number; // members whose last membership ended in the month and was not renewed
  expiring: number; // memberships that reached their end date in the month
  renewed: number; // of those, how many were followed by another membership
  renewalRatePercent: number | null;
  activeAtEnd: number; // members with a membership covering the last moment of the month
}

@Injectable()
export class ReportsService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: GymRulesService,
    private readonly finance: FinanceReportsService,
    private readonly memberships: MembershipsService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>("GYM_TIMEZONE")!;
  }

  // --- Dashboard -------------------------------------------------------------------------------

  /** Everything the owner's dashboard shows, computed from stored records at request time. */
  async dashboard() {
    const rules = await this.rules.get();
    const now = new Date();
    const monthStart = gymPeriodStart("month", this.tz, now);
    const dayStart = gymPeriodStart("day", this.tz, now);
    const sixMonthsAgo = this.monthsBack(5, now);
    const thirtyDaysAgo = gymDayStart(this.gymDateOf(new Date(now.getTime() - 29 * DAY_MS)), this.tz);
    const db = this.prisma.client;
    const soon = new Date(now.getTime() + rules.expiringSoonDays * DAY_MS);

    const [monthFinance, revenue6, growth, activeMembers, frozen, expiringSoon, todays, attendance30, distribution, recentPayments, upcoming, atRisk, debtors, newMembersMonth] = await Promise.all([
      this.finance.summary({ from: monthStart.toISOString(), to: now.toISOString() }),
      this.finance.summary({ from: sixMonthsAgo.toISOString(), to: now.toISOString(), groupBy: "month" }),
      this.membershipGrowth(6),
      db.user.count({ where: { role: "MEMBER", status: "ACTIVE", memberships: { some: runningNow(now) } } }),
      db.user.count({ where: { role: "MEMBER", memberships: { some: { status: "ACTIVE", ...frozenWhere(now) } } } }),
      db.membership.count({ where: { status: "ACTIVE", endDate: { gte: now, lte: soon }, renewals: { none: { status: "ACTIVE" } } } }),
      db.gymVisit.count({ where: { checkedInAt: { gte: dayStart } } }),
      this.visitsPerDay(thirtyDaysAgo, now),
      this.activeDistribution(now),
      db.payment.findMany({
        where: { status: "COMPLETED" },
        orderBy: { receivedAt: "desc" },
        take: 8,
        include: { user: { select: { id: true, firstName: true, lastName: true, memberNumber: true } }, invoice: { select: { number: true } } },
      }),
      this.memberships.expiring({ page: 1, pageSize: 8 }),
      this.atRisk({ page: 1, pageSize: 8 }),
      this.topDebtors(8),
      db.user.count({ where: { role: "MEMBER", createdAt: { gte: monthStart } } }),
    ]);

    return {
      generatedAt: now.toISOString(),
      kpis: {
        activeMembers,
        frozenMembers: frozen,
        newMembersThisMonth: newMembersMonth,
        monthlyRevenueCents: monthFinance.totals.receivedCents,
        monthlyRevenueChangePercent: monthFinance.totals.receivedChangePercent,
        monthlyExpensesCents: monthFinance.totals.expensesCents,
        monthlyNetCents: monthFinance.totals.netCents,
        outstandingCents: monthFinance.totals.outstandingCents,
        overdueCents: monthFinance.totals.overdueCents,
        expiringSoon,
        expiringSoonDays: rules.expiringSoonDays,
        todaysCheckIns: todays,
        atRiskCount: atRisk.meta.total,
        atRiskDays: atRisk.days,
      },
      revenueSeries: revenue6.series,
      membershipGrowth: growth,
      attendanceTrend: attendance30,
      distribution,
      recentPayments,
      upcomingExpirations: upcoming.data,
      atRiskMembers: atRisk.data,
      outstandingBalances: debtors,
    };
  }

  // --- Membership growth ---------------------------------------------------------------------------

  /** Month-by-month: new, renewed and lost members, renewal rate, and the change against the previous month. */
  async membershipGrowth(months = 12) {
    const now = new Date();
    const first = this.monthsBack(months - 1, now);
    const db = this.prisma.client;

    const [registered, memberships, ended] = await Promise.all([
      db.$queryRaw<Array<{ m: string; n: number }>>(Prisma.sql`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE ${this.tz}), 'YYYY-MM') AS m, COUNT(*)::int AS n
        FROM "User" WHERE role = 'MEMBER' AND "createdAt" >= ${first} GROUP BY 1`),
      db.$queryRaw<Array<{ m: string; renewal: boolean; n: number }>>(Prisma.sql`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE ${this.tz}), 'YYYY-MM') AS m, ("renewedFromId" IS NOT NULL) AS renewal, COUNT(*)::int AS n
        FROM "Membership" WHERE status = 'ACTIVE' AND "createdAt" >= ${first} GROUP BY 1, 2`),
      // Memberships that reached their end date in the month, and whether the member continued afterwards.
      db.$queryRaw<Array<{ m: string; expiring: number; renewed: number; lost: number }>>(Prisma.sql`
        SELECT to_char(date_trunc('month', m."endDate" AT TIME ZONE ${this.tz}), 'YYYY-MM') AS m,
               COUNT(*)::int AS expiring,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Membership" n WHERE n."userId" = m."userId" AND n.id <> m.id AND n.status = 'ACTIVE' AND n."startDate" >= m."startDate" AND n."endDate" > m."endDate"))::int AS renewed,
               COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "Membership" n WHERE n."userId" = m."userId" AND n.id <> m.id AND n.status = 'ACTIVE' AND n."endDate" > m."endDate"))::int AS lost
        FROM "Membership" m
        WHERE m.status = 'ACTIVE' AND m."endDate" >= ${first} AND m."endDate" <= ${now}
        GROUP BY 1`),
    ]);

    const rows: MonthlyGrowth[] = [];
    for (let i = 0; i < months; i++) {
      const start = this.monthsBack(months - 1 - i, now);
      const key = this.monthKey(start);
      const next = i === months - 1 ? now : this.monthsBack(months - 2 - i, now);
      const sold = memberships.filter((r) => r.m === key);
      const e = ended.find((r) => r.m === key);
      const active = await db.user.count({ where: { role: "MEMBER", memberships: { some: { status: "ACTIVE", startDate: { lte: next }, endDate: { gte: new Date(next.getTime() - 1) } } } } });
      rows.push({
        month: key,
        newMembers: registered.find((r) => r.m === key)?.n ?? 0,
        newMemberships: sold.filter((r) => !r.renewal).reduce((n, r) => n + r.n, 0),
        renewals: sold.filter((r) => r.renewal).reduce((n, r) => n + r.n, 0),
        lost: e?.lost ?? 0,
        expiring: e?.expiring ?? 0,
        renewed: e?.renewed ?? 0,
        renewalRatePercent: e && e.expiring > 0 ? Math.round((e.renewed / e.expiring) * 100) : null,
        activeAtEnd: active,
      });
    }
    return rows.map((r, i) => ({
      ...r,
      newMembersChangePercent: i > 0 && rows[i - 1].newMembers > 0 ? Math.round(((r.newMembers - rows[i - 1].newMembers) / rows[i - 1].newMembers) * 100) : null,
    }));
  }

  // --- Attendance ------------------------------------------------------------------------------------

  /** Visits per day, per hour of day and per weekday (the busy times), plus the most regular members. */
  async attendance(from?: string, to?: string) {
    const now = new Date();
    const start = from ? new Date(from) : gymPeriodStart("month", this.tz, now);
    const end = to ? new Date(to) : now;
    const db = this.prisma.client;
    const [daily, byHour, byWeekday, top, totals] = await Promise.all([
      this.visitsPerDay(start, end),
      db.$queryRaw<Array<{ hour: number; n: number }>>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM "checkedInAt" AT TIME ZONE ${this.tz})::int AS hour, COUNT(*)::int AS n
        FROM "GymVisit" WHERE "checkedInAt" >= ${start} AND "checkedInAt" <= ${end} GROUP BY 1 ORDER BY 1`),
      db.$queryRaw<Array<{ dow: number; n: number }>>(Prisma.sql`
        SELECT EXTRACT(ISODOW FROM "checkedInAt" AT TIME ZONE ${this.tz})::int AS dow, COUNT(*)::int AS n
        FROM "GymVisit" WHERE "checkedInAt" >= ${start} AND "checkedInAt" <= ${end} GROUP BY 1 ORDER BY 1`),
      db.gymVisit.groupBy({ by: ["userId"], where: { checkedInAt: { gte: start, lte: end } }, _count: { _all: true }, orderBy: { _count: { userId: "desc" } }, take: 10 }),
      db.gymVisit.aggregate({ where: { checkedInAt: { gte: start, lte: end } }, _count: { _all: true } }),
    ]);
    const users = await db.user.findMany({ where: { id: { in: top.map((t) => t.userId) } }, select: { id: true, firstName: true, lastName: true, memberNumber: true } });
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: byHour.find((r) => r.hour === h)?.n ?? 0 }));
    const peak = [...hours].sort((a, b) => b.visits - a.visits)[0];
    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      totalVisits: totals._count._all,
      uniqueMembers: (await db.gymVisit.findMany({ where: { checkedInAt: { gte: start, lte: end } }, distinct: ["userId"], select: { userId: true } })).length,
      daily,
      byHour: hours,
      peakHour: peak && peak.visits > 0 ? peak : null,
      byWeekday: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, visits: byWeekday.find((r) => r.dow === i + 1)?.n ?? 0 })),
      topMembers: top.map((t) => ({ ...(users.find((u) => u.id === t.userId) ?? { id: t.userId }), visits: t._count._all })),
    };
  }

  private async visitsPerDay(from: Date, to: Date) {
    const rows = await this.prisma.client.$queryRaw<Array<{ d: string; n: number }>>(Prisma.sql`
      SELECT to_char(date_trunc('day', "checkedInAt" AT TIME ZONE ${this.tz}), 'YYYY-MM-DD') AS d, COUNT(*)::int AS n
      FROM "GymVisit" WHERE "checkedInAt" >= ${from} AND "checkedInAt" <= ${to} GROUP BY 1 ORDER BY 1`);
    return rows.map((r) => ({ date: r.d, visits: r.n }));
  }

  // --- At-risk members ---------------------------------------------------------------------------------

  /**
   * Members with a running membership who have not visited for N days (and have had N days since joining to do so).
   * The staff is meant to contact them - so the list carries what they need to do that.
   */
  async atRisk(query: { page?: number; pageSize?: number; days?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const rules = await this.rules.get();
    const days = query.days ?? rules.atRiskShortDays;
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY_MS);

    const where: Prisma.UserWhereInput = {
      role: "MEMBER",
      status: "ACTIVE",
      createdAt: { lt: since },
      memberships: { some: runningNow(now) },
      visits: { none: { checkedInAt: { gte: since } } },
    };
    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          memberNumber: true,
          createdAt: true,
          assignedCoach: { select: { user: { select: { firstName: true, lastName: true } } } },
          memberships: { where: { status: "ACTIVE", endDate: { gte: now } }, orderBy: { endDate: "desc" }, take: 1, select: { endDate: true, plan: { select: { name: true } } } },
          visits: { orderBy: { checkedInAt: "desc" }, take: 1, select: { checkedInAt: true } },
        },
        orderBy: { createdAt: "asc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.user.count({ where }),
    ]);
    const data = users
      .map((u) => {
        const last = u.visits[0]?.checkedInAt ?? null;
        return {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: u.phone,
          memberNumber: u.memberNumber,
          assignedTrainer: u.assignedCoach ? `${u.assignedCoach.user.firstName} ${u.assignedCoach.user.lastName}` : null,
          plan: u.memberships[0]?.plan.name ?? null,
          membershipEnds: u.memberships[0]?.endDate ?? null,
          lastVisitAt: last,
          daysSinceLastVisit: last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : null, // null = has never visited
        };
      })
      .sort((a, b) => (b.daysSinceLastVisit ?? Infinity) - (a.daysSinceLastVisit ?? Infinity));
    return { ...paginate(data, total, page, pageSize), days };
  }

  // --- Distribution / balances ---------------------------------------------------------------------------

  private async activeDistribution(now: Date) {
    const rows = await this.prisma.client.$queryRaw<Array<{ plan: string; type: string; n: number }>>(Prisma.sql`
      SELECT mp.name AS plan, mp."planType"::text AS type, COUNT(DISTINCT m."userId")::int AS n
      FROM "Membership" m JOIN "MembershipPlan" mp ON mp.id = m."planId"
      WHERE m.status = 'ACTIVE' AND m."startDate" <= ${now} AND m."endDate" >= ${now}
      GROUP BY mp.name, mp."planType" ORDER BY n DESC`);
    const byType = new Map<string, number>();
    rows.forEach((r) => byType.set(r.type, (byType.get(r.type) ?? 0) + r.n));
    return { byPlan: rows.map((r) => ({ plan: r.plan, type: r.type, members: r.n })), byType: [...byType.entries()].map(([type, members]) => ({ type, members })) };
  }

  /** Members with the largest unpaid balances. */
  async topDebtors(limit = 20) {
    const rows = await this.prisma.client.$queryRaw<Array<{ userId: string; balance: number; overdue: number; invoices: number; oldest: Date }>>(Prisma.sql`
      SELECT i."userId", SUM(GREATEST(i."totalCents" - COALESCE(p.paid, 0), 0))::int AS balance,
             SUM(CASE WHEN i."dueDate" + interval '1 day' < now() THEN GREATEST(i."totalCents" - COALESCE(p.paid, 0), 0) ELSE 0 END)::int AS overdue,
             COUNT(*)::int AS invoices, MIN(i."dueDate") AS oldest
      FROM "Invoice" i
      LEFT JOIN (SELECT "invoiceId", SUM("amountCents") AS paid FROM "Payment" WHERE status = 'COMPLETED' GROUP BY "invoiceId") p ON p."invoiceId" = i.id
      WHERE i.status = 'OPEN' AND i."totalCents" > COALESCE(p.paid, 0)
      GROUP BY i."userId" ORDER BY balance DESC LIMIT ${limit}`);
    const users = await this.prisma.client.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, firstName: true, lastName: true, phone: true, memberNumber: true } });
    return rows.map((r) => ({ ...(users.find((u) => u.id === r.userId) ?? { id: r.userId }), balanceCents: r.balance, overdueCents: r.overdue, openInvoices: r.invoices, oldestDueDate: r.oldest }));
  }

  // --- Trainers --------------------------------------------------------------------------------------------

  /** Trainer workload and activity: clients, classes run, participation, WODs written. */
  async trainerActivity(from?: string, to?: string) {
    const now = new Date();
    const start = from ? new Date(from) : gymPeriodStart("month", this.tz, now);
    const end = to ? new Date(to) : now;
    const coaches = await this.prisma.client.coach.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { clients: true } },
        classes: { where: { startTime: { gte: start, lte: end }, status: { not: "CANCELLED" } }, select: { id: true, bookedCount: true, capacity: true, status: true } },
      },
    });
    const wods = await this.prisma.client.wod.groupBy({ by: ["createdById"], where: { createdAt: { gte: start, lte: end } }, _count: { _all: true } });
    const attended = await this.prisma.client.attendance.groupBy({
      by: ["classId"],
      where: { status: "CHECKED_IN", class: { startTime: { gte: start, lte: end } } },
      _count: { _all: true },
    });
    const attendedByClass = new Map(attended.map((a) => [a.classId, a._count._all]));
    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      trainers: coaches
        .map((c) => ({
          coachId: c.id,
          name: `${c.user.firstName} ${c.user.lastName}`,
          isActive: c.isActive,
          assignedClients: c._count.clients,
          classesScheduled: c.classes.length,
          totalBookings: c.classes.reduce((n, k) => n + k.bookedCount, 0),
          totalCapacity: c.classes.reduce((n, k) => n + k.capacity, 0),
          checkedInAttendees: c.classes.reduce((n, k) => n + (attendedByClass.get(k.id) ?? 0), 0),
          wodsWritten: wods.find((w) => w.createdById === c.user.id)?._count._all ?? 0,
        }))
        .sort((a, b) => b.assignedClients - a.assignedClients),
    };
  }

  // --- Monthly business report ------------------------------------------------------------------------------

  /** Revenue, expenses, member numbers, renewals, unpaid obligations and attendance for one calendar month. */
  async monthly(month?: string) {
    const now = new Date();
    const key = month ?? this.monthKey(gymPeriodStart("month", this.tz, now));
    const [y, m] = key.split("-").map(Number);
    if (!y || !m) throw new BadRequestException("Invalid month");
    const start = gymDayStart(`${key}-01`, this.tz);
    const nextKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    const end = new Date(Math.min(gymDayStart(`${nextKey}-01`, this.tz).getTime() - 1, now.getTime()));

    const [finance, growth, attendance, debtors, packages, members] = await Promise.all([
      this.finance.summary({ from: start.toISOString(), to: end.toISOString(), groupBy: "week" }),
      this.membershipGrowth(Math.max(2, this.monthsBetween(start, now) + 1)),
      this.attendance(start.toISOString(), end.toISOString()),
      this.topDebtors(15),
      this.finance.summary({ from: start.toISOString(), to: end.toISOString() }).then((s) => s.byPlan),
      this.prisma.client.user.count({ where: { role: "MEMBER" } }),
    ]);
    const row = growth.find((g) => g.month === key) ?? null;
    return {
      month: key,
      period: { from: start.toISOString(), to: end.toISOString(), isComplete: end.getTime() < now.getTime() },
      finance: {
        receivedCents: finance.totals.receivedCents,
        billedCents: finance.totals.billedCents,
        expensesCents: finance.totals.expensesCents,
        netCents: finance.totals.netCents,
        outstandingCents: finance.totals.outstandingCents,
        overdueCents: finance.totals.overdueCents,
        previousPeriodReceivedCents: finance.totals.previousReceivedCents,
        receivedChangePercent: finance.totals.receivedChangePercent,
        byMethod: finance.byMethod,
        expensesByCategory: finance.expensesByCategory,
      },
      members: { totalRegistered: members, activeAtEnd: row?.activeAtEnd ?? null, newMembers: row?.newMembers ?? 0, newMemberships: row?.newMemberships ?? 0, renewals: row?.renewals ?? 0, lost: row?.lost ?? 0, renewalRatePercent: row?.renewalRatePercent ?? null },
      packagesSold: packages,
      attendance: { totalVisits: attendance.totalVisits, uniqueMembers: attendance.uniqueMembers, peakHour: attendance.peakHour },
      unpaidObligations: debtors,
    };
  }

  // --- helpers ---------------------------------------------------------------------------------------------

  private gymDateOf(d: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: this.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }

  private monthKey(instant: Date): string {
    return this.gymDateOf(instant).slice(0, 7);
  }

  /** Start (instant) of the gym month that is `n` months before the current one. */
  private monthsBack(n: number, now: Date): Date {
    const [y, m] = this.gymDateOf(now).slice(0, 7).split("-").map(Number);
    const total = y * 12 + (m - 1) - n;
    return gymDayStart(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`, this.tz);
  }

  private monthsBetween(from: Date, to: Date): number {
    const [y1, m1] = this.gymDateOf(from).slice(0, 7).split("-").map(Number);
    const [y2, m2] = this.gymDateOf(to).slice(0, 7).split("-").map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  }
}
