import { createHash } from "node:crypto";
import { PrismaClient, Role } from "../generated/client";

// FICTIONAL day-to-day operations for a development database: packages with made-up prices, invoices, payments,
// gym visits, expenses, trainer assignments, a workout plan, body measurements and a message. Nothing here is real
// Illyrian Gym data - the prices in particular are placeholders so the money screens have something to show; the
// real price list is entered by the owner in Memberships. Idempotent (stable ids) and never run in production.

const DAY = 86_400_000;

function demoId(name: string): string {
  const h = createHash("sha1").update(`illyrian-gym-demo:${name}`).digest("hex");
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

export interface DemoContext {
  prisma: PrismaClient;
  passwordHash: string;
  now: Date;
  /** The twelve bulk members, in the order their memberships were created (seed-membership-<i>). */
  members: Array<{ id: string }>;
  demoMemberId: string;
  demoTrainerUserId: string;
  coachIds: string[];
  demoCoachId: string;
}

export const DEMO_RECEPTION_EMAIL = "reception@illyriangym.local";

export async function seedDemoOperations(ctx: DemoContext) {
  const { prisma, now } = ctx;

  // --- A demo receptionist (to try the front-desk role) ------------------------------------------------
  const reception = await prisma.user.upsert({
    where: { email: DEMO_RECEPTION_EMAIL },
    update: {},
    create: { email: DEMO_RECEPTION_EMAIL, passwordHash: ctx.passwordHash, firstName: "Demo", lastName: "Reception", role: Role.RECEPTIONIST, emailVerifiedAt: new Date() },
  });

  // --- Member numbers for anyone who does not have one yet -------------------------------------------------
  const unnumbered = await prisma.user.findMany({ where: { role: Role.MEMBER, memberNumber: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  for (const u of unnumbered) {
    const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('member_number_seq') AS n`;
    await prisma.user.update({ where: { id: u.id }, data: { memberNumber: `IG-${String(n).padStart(5, "0")}` } });
  }

  // --- Packages with placeholder prices ---------------------------------------------------------------------
  const note = "Fictional development price - not an Illyrian Gym price.";
  const plans = [
    { key: "gym", name: "Demo Gym Monthly", planType: "GYM", period: "MONTHLY", durationDays: 30, priceCents: 2500 },
    { key: "crossfit", name: "Demo CrossFit Monthly", planType: "CROSSFIT", period: "MONTHLY", durationDays: 30, priceCents: 3500 },
    { key: "combined3", name: "Demo Combined 3 Months", planType: "COMBINED", period: "QUARTERLY", durationDays: 90, priceCents: 9000 },
  ] as const;
  const planRows = [];
  for (const p of plans) {
    planRows.push(
      await prisma.membershipPlan.upsert({
        where: { id: demoId(`seed-priced-plan-${p.key}`) },
        update: {},
        create: { id: demoId(`seed-priced-plan-${p.key}`), name: p.name, description: note, planType: p.planType, period: p.period, durationDays: p.durationDays, priceCents: p.priceCents, isActive: true },
      }),
    );
  }
  await prisma.promotion.upsert({
    where: { id: demoId("seed-promo-student") },
    update: {},
    create: { id: demoId("seed-promo-student"), name: "Demo student discount", percentOff: 10, isActive: true },
  });

  // --- Invoices and payments for the bulk members -----------------------------------------------------------
  const ensureInvoice = async (key: string, userId: string, membershipId: string, description: string, totalCents: number, issuedAt: Date, dueDate: Date) => {
    const id = demoId(`seed-invoice-${key}`);
    if (!(await prisma.invoice.findUnique({ where: { id } }))) {
      const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('invoice_number_seq') AS n`;
      await prisma.invoice.create({
        data: {
          id,
          number: `INV-${issuedAt.getUTCFullYear()}-${String(n).padStart(6, "0")}`,
          userId,
          membershipId,
          issuedAt,
          dueDate,
          description,
          subtotalCents: totalCents,
          totalCents,
          createdById: reception.id,
          lines: { create: [{ description, amountCents: totalCents }] },
        },
      });
    }
    return id;
  };
  const ensurePayment = async (key: string, userId: string, invoiceId: string, membershipId: string, amountCents: number, method: "CASH" | "BANK" | "CARD", receivedAt: Date) => {
    await prisma.payment.upsert({
      where: { id: demoId(`seed-payment-${key}`) },
      update: {},
      create: { id: demoId(`seed-payment-${key}`), userId, invoiceId, membershipId, amountCents, method, receivedAt, recordedById: reception.id, reference: method === "BANK" ? `DEMO-${key}` : undefined },
    });
  };

  const scenarios = ["paid-cash", "paid-bank", "partial-card", "unpaid-overdue", "paid-card", "unpaid-pending"] as const;
  for (const [i, member] of ctx.members.entries()) {
    const plan = planRows[i % planRows.length];
    const membershipId = demoId(`seed-membership-${i}`);
    const scenario = scenarios[i % scenarios.length];
    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) continue;

    const issuedAt = new Date(Math.max(membership.startDate.getTime(), now.getTime() - (i * 2 + 2) * DAY));
    const dueDate = scenario === "unpaid-pending" ? new Date(now.getTime() + 5 * DAY) : issuedAt;
    const total = plan.priceCents!;
    const invoiceId = await ensureInvoice(`m${i}`, member.id, membershipId, `${plan.name}`, total, issuedAt, dueDate);

    let paid = 0;
    if (scenario === "paid-cash") paid = total;
    if (scenario === "paid-bank") paid = total;
    if (scenario === "paid-card") paid = total;
    if (scenario === "partial-card") paid = Math.round(total * 0.4);
    if (paid > 0) await ensurePayment(`m${i}`, member.id, invoiceId, membershipId, paid, scenario.endsWith("bank") ? "BANK" : scenario.endsWith("card") ? "CARD" : "CASH", new Date(issuedAt.getTime() + 3_600_000));

    await prisma.membership.update({
      where: { id: membershipId },
      data: { planId: plan.id, priceCents: total, paymentStatus: paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" },
    });

    // Earlier history, so the six-month charts and renewal rate have something to show.
    if (i < 8) {
      const oldId = demoId(`seed-membership-old-${i}`);
      const start = new Date(now.getTime() - (62 + i * 3) * DAY);
      const end = new Date(start.getTime() + 30 * DAY);
      await prisma.membership.upsert({
        where: { id: oldId },
        update: {},
        create: { id: oldId, userId: member.id, planId: plan.id, startDate: start, endDate: end, priceCents: total, paymentStatus: "PAID", createdAt: start },
      });
      const oldInvoice = await ensureInvoice(`old${i}`, member.id, oldId, `${plan.name}`, total, start, start);
      await ensurePayment(`old${i}`, member.id, oldInvoice, oldId, total, i % 2 ? "BANK" : "CASH", new Date(start.getTime() + 7_200_000));
    }
  }

  // The demo member (login) is fully paid.
  {
    const plan = planRows[2];
    const membershipId = demoId("seed-membership-demo-member");
    const issuedAt = new Date(now.getTime() - 5 * DAY);
    const invoiceId = await ensureInvoice("demo-member", ctx.demoMemberId, membershipId, plan.name, plan.priceCents!, issuedAt, issuedAt);
    await ensurePayment("demo-member", ctx.demoMemberId, invoiceId, membershipId, plan.priceCents!, "BANK", new Date(issuedAt.getTime() + 3_600_000));
    await prisma.membership.update({ where: { id: membershipId }, data: { planId: plan.id, priceCents: plan.priceCents, paymentStatus: "PAID" } });
  }

  // --- Gym visits (two members are deliberately drifting away) -------------------------------------------------
  const driftingAway = new Set([3, 7]);
  for (const [i, member] of ctx.members.entries()) {
    if (i % 5 === 0) continue; // expired memberships do not visit
    for (let d = 0; d < 28; d++) {
      if (driftingAway.has(i) && d < 16) continue;
      if ((i + d) % (2 + (i % 3)) !== 0) continue;
      const hour = 6 + ((i * 5 + d * 3) % 15);
      let at = new Date(now.getTime() - d * DAY);
      at = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), hour - 1, (i * 7) % 60));
      if (at.getTime() > now.getTime()) at = new Date(now.getTime() - ((i * 37) % 240 + 5) * 60_000);
      await prisma.gymVisit.upsert({
        where: { id: demoId(`seed-visit-${i}-${d}`) },
        update: {},
        create: { id: demoId(`seed-visit-${i}-${d}`), userId: member.id, membershipId: demoId(`seed-membership-${i}`), checkedInAt: at, method: i % 2 === 0 ? "QR" : "MANUAL", recordedById: reception.id },
      });
    }
  }

  // --- Expenses -------------------------------------------------------------------------------------------------
  const expenses = [
    { key: "rent-now", category: "RENT", description: "Demo: rent", amountCents: 80_000, days: 3 },
    { key: "rent-prev", category: "RENT", description: "Demo: rent", amountCents: 80_000, days: 33 },
    { key: "equip", category: "EQUIPMENT", description: "Demo: new barbell collars", amountCents: 6_500, days: 9 },
    { key: "util", category: "UTILITIES", description: "Demo: electricity", amountCents: 21_000, days: 12 },
    { key: "maint", category: "MAINTENANCE", description: "Demo: treadmill service", amountCents: 9_000, days: 40 },
    { key: "mkt", category: "MARKETING", description: "Demo: social media ads", amountCents: 12_000, days: 18 },
  ] as const;
  for (const e of expenses) {
    await prisma.expense.upsert({
      where: { id: demoId(`seed-expense-${e.key}`) },
      update: {},
      create: { id: demoId(`seed-expense-${e.key}`), category: e.category, description: e.description, amountCents: e.amountCents, spentAt: new Date(now.getTime() - e.days * DAY), recordedById: reception.id },
    });
  }

  // --- Trainer assignments ----------------------------------------------------------------------------------------
  const roster = [ctx.demoCoachId, ...ctx.coachIds];
  for (const [i, member] of ctx.members.entries()) {
    await prisma.user.updateMany({ where: { id: member.id, assignedCoachId: null }, data: { assignedCoachId: roster[i % roster.length] } });
  }
  await prisma.user.updateMany({ where: { id: ctx.demoMemberId, assignedCoachId: null }, data: { assignedCoachId: ctx.demoCoachId } });

  // --- Coaching: a plan, a note, body measurements ------------------------------------------------------------------
  const exercise = (name: string) => prisma.exercise.findUnique({ where: { name } });
  const squat = await exercise("Back Squat");
  const row = await exercise("Row (500m)");
  if (squat && row) {
    await prisma.workoutPlan.upsert({
      where: { id: demoId("seed-plan-demo-member") },
      update: {},
      create: {
        id: demoId("seed-plan-demo-member"),
        userId: ctx.demoMemberId,
        createdById: ctx.demoTrainerUserId,
        title: "Demo strength block",
        goal: "Demo goal: add 10 kg to the back squat",
        startsOn: new Date(now.getTime() - 7 * DAY),
        items: {
          create: [
            { weekday: 1, position: 0, exerciseId: squat.id, sets: 5, reps: 5, weightKg: 70 },
            { weekday: 3, position: 0, exerciseId: row.id, durationSeconds: 600, notes: "Steady pace" },
            { weekday: 5, position: 0, exerciseId: squat.id, sets: 3, reps: 8, weightKg: 60 },
          ],
        },
      },
    });
  }
  await prisma.trainerNote.upsert({
    where: { id: demoId("seed-note-1") },
    update: {},
    create: { id: demoId("seed-note-1"), memberId: ctx.demoMemberId, authorId: ctx.demoTrainerUserId, body: "Demo note: good depth on squats, work on keeping the chest up." },
  });
  const measurements = [
    { key: 1, days: 42, weightKg: 82.5, waistCm: 90, shared: true },
    { key: 2, days: 21, weightKg: 81.2, waistCm: 88.5, shared: true },
    { key: 3, days: 2, weightKg: 80.4, waistCm: 87, shared: false },
  ];
  for (const m of measurements) {
    await prisma.bodyMeasurement.upsert({
      where: { id: demoId(`seed-measure-${m.key}`) },
      update: {},
      create: { id: demoId(`seed-measure-${m.key}`), userId: ctx.demoMemberId, measuredAt: new Date(now.getTime() - m.days * DAY), weightKg: m.weightKg, waistCm: m.waistCm, sharedWithCoach: m.shared },
    });
  }

  // --- A message with an in-app notification -----------------------------------------------------------------------
  const messageId = demoId("seed-message-1");
  if (!(await prisma.message.findUnique({ where: { id: messageId } }))) {
    const notificationId = demoId("seed-message-1-notification");
    await prisma.message.create({
      data: { id: messageId, subject: "Demo: welcome to Illyrian Gym", body: "This is a demo message sent from the front desk.", type: "MESSAGE", audience: "INDIVIDUAL", sentById: reception.id, recipientCount: 1 },
    });
    await prisma.notification.create({ data: { id: notificationId, userId: ctx.demoMemberId, type: "MESSAGE", title: "Demo: welcome to Illyrian Gym", body: "This is a demo message sent from the front desk.", data: { messageId } } });
    await prisma.messageRecipient.create({ data: { messageId, userId: ctx.demoMemberId, notificationId } });
  }

  console.log(`  Demo Reception: ${DEMO_RECEPTION_EMAIL}`);
}
