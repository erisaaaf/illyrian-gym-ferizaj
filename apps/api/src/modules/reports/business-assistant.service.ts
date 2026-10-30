import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { GymRulesService } from "../../common/gym-rules.service";
import { gymPeriodStart } from "../../common/gym-time";
import { FinanceReportsService } from "../finance/finance-reports.service";
import { formatMoney } from "../finance/finance.util";
import { ReportsService } from "./reports.service";

type Lang = "sq" | "en";
type Intent = "revenue" | "expenses" | "packages" | "expiring" | "members" | "checkins" | "atRisk" | "outstanding" | "renewals";

export interface Answer {
  intent: Intent | "unknown";
  language: Lang;
  answer: string;
  /** The records behind the answer, so the owner can verify it. */
  data?: unknown;
  /** Honest label: this is a rules-based assistant over the gym database, not a language model. */
  engine: "database-queries";
}

// Keyword intents, English and Albanian (the requirements document's own examples are Albanian).
const INTENTS: Array<{ intent: Intent; words: RegExp }> = [
  { intent: "packages", words: /(paket|package|plan|shit(en|et|ur)|sold|selling|best.?sell|most)/i },
  { intent: "expiring", words: /(skad|expir|ending|end soon|mbaron)/i },
  { intent: "atRisk", words: /(rrezik|risk|nuk kan[ëe] ardhur|not (visited|come)|inactive|joaktiv|mungojn)/i },
  { intent: "outstanding", words: /(borxh|detyrim|papaguar|unpaid|outstanding|overdue|owe|debt)/i },
  { intent: "renewals", words: /(rinov|renew|largu|churn|lost)/i },
  { intent: "checkins", words: /(check.?in|hyrje|vizit|visit|ardhur sot|today)/i },
  { intent: "expenses", words: /(shpenzim|expense|cost|spend|kosto)/i },
  { intent: "revenue", words: /(t[ëe] hyra|hyr[ae]|revenue|income|earn|fitim|pagesa|payments? (received|this)|sa kemi)/i },
  { intent: "members", words: /(an[ëe]tar|member|klient|client)/i },
];

const ALBANIAN = /(sa |cil[ae]t|jav[ëe]n|muaj|t[ëe] hyra|an[ëe]tar|skad|shpenzim|borxh|paket|sot|rrezik|rinov)/i;

@Injectable()
export class BusinessAssistantService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: GymRulesService,
    private readonly finance: FinanceReportsService,
    private readonly reports: ReportsService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>("GYM_TIMEZONE")!;
  }

  async ask(question: string): Promise<Answer> {
    const language: Lang = ALBANIAN.test(question) ? "sq" : "en";
    const intent = INTENTS.find((i) => i.words.test(question))?.intent;
    if (!intent) {
      return {
        intent: "unknown",
        language,
        engine: "database-queries",
        answer:
          language === "sq"
            ? "Nuk e kuptova pyetjen. Mund të përgjigjem për: të hyrat, shpenzimet, paketat që shiten më shumë, anëtarësitë që skadojnë, anëtarët aktivë, hyrjet sot, anëtarët në rrezik dhe borxhet e papaguara."
            : "I did not understand that. I can answer questions about: revenue, expenses, best-selling packages, memberships expiring, active members, today's check-ins, at-risk members and unpaid balances.",
      };
    }
    return this.answer(intent, language);
  }

  private async answer(intent: Intent, lang: Lang): Promise<Answer> {
    const sq = lang === "sq";
    const now = new Date();
    const rules = await this.rules.get();
    const base = { intent, language: lang, engine: "database-queries" as const };

    switch (intent) {
      case "revenue": {
        const s = await this.finance.summary({});
        const t = s.totals;
        const change = t.receivedChangePercent === null ? "" : sq ? ` (${t.receivedChangePercent >= 0 ? "+" : ""}${t.receivedChangePercent}% krahasuar me periudhën e kaluar)` : ` (${t.receivedChangePercent >= 0 ? "+" : ""}${t.receivedChangePercent}% vs the previous period)`;
        return {
          ...base,
          answer: sq
            ? `Këtë muaj janë pranuar ${formatMoney(t.receivedCents)} nga ${t.paymentsCount} pagesa${change}. Janë lëshuar fatura për ${formatMoney(t.billedCents)} (kjo nuk është e ardhur e pranuar).`
            : `This month the gym has received ${formatMoney(t.receivedCents)} from ${t.paymentsCount} payments${change}. Invoices issued total ${formatMoney(t.billedCents)} (billed, not received).`,
          data: { period: s.period, totals: t, byMethod: s.byMethod },
        };
      }
      case "expenses": {
        const s = await this.finance.summary({});
        return {
          ...base,
          answer: sq
            ? `Shpenzimet e regjistruara këtë muaj janë ${formatMoney(s.totals.expensesCents)}; rezultati neto (të hyra të pranuara − shpenzime) është ${formatMoney(s.totals.netCents)}.`
            : `Recorded expenses this month are ${formatMoney(s.totals.expensesCents)}; net (received − expenses) is ${formatMoney(s.totals.netCents)}.`,
          data: { expensesByCategory: s.expensesByCategory },
        };
      }
      case "packages": {
        const since = gymPeriodStart("month", this.tz, now);
        const rows = await this.prisma.client.$queryRaw<Array<{ plan: string; sold: number; renewals: number }>>(Prisma.sql`
          SELECT mp.name AS plan, COUNT(*)::int AS sold, COUNT(*) FILTER (WHERE m."renewedFromId" IS NOT NULL)::int AS renewals
          FROM "Membership" m JOIN "MembershipPlan" mp ON mp.id = m."planId"
          WHERE m.status = 'ACTIVE' AND m."createdAt" >= ${since} GROUP BY mp.name ORDER BY sold DESC`);
        if (rows.length === 0) return { ...base, answer: sq ? "Këtë muaj nuk është shitur asnjë paketë ende." : "No packages have been sold this month yet.", data: [] };
        const top = rows[0];
        return {
          ...base,
          answer: sq
            ? `Paketa që po shitet më shumë këtë muaj është "${top.plan}" me ${top.sold} shitje. Gjithsej ${rows.reduce((n, r) => n + r.sold, 0)} anëtarësi të shitura.`
            : `The best-selling package this month is "${top.plan}" with ${top.sold} sold. ${rows.reduce((n, r) => n + r.sold, 0)} memberships sold in total.`,
          data: rows,
        };
      }
      case "expiring": {
        const days = 7;
        const until = new Date(now.getTime() + days * 86_400_000);
        const count = await this.prisma.client.membership.count({ where: { status: "ACTIVE", endDate: { gte: now, lte: until }, renewals: { none: { status: "ACTIVE" } } } });
        return {
          ...base,
          answer: sq ? `${count} anëtarësi skadojnë në ${days} ditët e ardhshme dhe ende nuk janë rinovuar.` : `${count} memberships expire in the next ${days} days and have not been renewed yet.`,
          data: { days, count },
        };
      }
      case "members": {
        const [active, total] = await Promise.all([
          this.prisma.client.user.count({ where: { role: "MEMBER", status: "ACTIVE", memberships: { some: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } } } } }),
          this.prisma.client.user.count({ where: { role: "MEMBER" } }),
        ]);
        return {
          ...base,
          answer: sq ? `${active} anëtarë kanë një anëtarësi aktive tani, nga ${total} gjithsej të regjistruar.` : `${active} members have a running membership right now, out of ${total} registered.`,
          data: { active, total },
        };
      }
      case "checkins": {
        const since = gymPeriodStart("day", this.tz, now);
        const n = await this.prisma.client.gymVisit.count({ where: { checkedInAt: { gte: since } } });
        return { ...base, answer: sq ? `Sot janë regjistruar ${n} hyrje në palestër.` : `${n} gym check-ins have been recorded today.`, data: { today: n } };
      }
      case "atRisk": {
        const r = await this.reports.atRisk({ page: 1, pageSize: 10, days: rules.atRiskShortDays });
        return {
          ...base,
          answer: sq
            ? `${r.meta.total} anëtarë me anëtarësi aktive nuk kanë ardhur për ${r.days} ditë ose më shumë. Lista përmban kontaktet për t'i kontaktuar.`
            : `${r.meta.total} members with a running membership have not visited for ${r.days} days or more. The list has their contact details.`,
          data: r.data,
        };
      }
      case "outstanding": {
        const s = await this.finance.summary({});
        const top = await this.reports.topDebtors(5);
        return {
          ...base,
          answer: sq
            ? `Gjithsej mbeten të papaguara ${formatMoney(s.totals.outstandingCents)}, nga të cilat ${formatMoney(s.totals.overdueCents)} janë me afat të kaluar.`
            : `${formatMoney(s.totals.outstandingCents)} is currently unpaid, of which ${formatMoney(s.totals.overdueCents)} is overdue.`,
          data: top,
        };
      }
      case "renewals": {
        const g = await this.reports.membershipGrowth(2);
        const last = g[g.length - 1];
        return {
          ...base,
          answer: sq
            ? `Këtë muaj: ${last.newMemberships} anëtarësi të reja, ${last.renewals} rinovime, ${last.lost} anëtarë të larguar.${last.renewalRatePercent !== null ? ` Norma e rinovimit është ${last.renewalRatePercent}%.` : ""}`
            : `This month: ${last.newMemberships} new memberships, ${last.renewals} renewals, ${last.lost} members lost.${last.renewalRatePercent !== null ? ` Renewal rate is ${last.renewalRatePercent}%.` : ""}`,
          data: g,
        };
      }
    }
  }
}
