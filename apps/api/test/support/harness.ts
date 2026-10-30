import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcryptjs";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureBodyParsers } from "../../src/common/body-parsers";
import { PrismaService } from "../../src/prisma/prisma.service";

/**
 * Shared end-to-end harness: boots the real AppModule against the real
 * database, creates a throw-away admin, and creates trainers / members the way
 * the product does (through the Admin API, collecting the one-time credentials).
 * Everything created is tagged with `tag` so `cleanup()` removes it again.
 */
export interface Account {
  id: string;
  coachId?: string;
  email: string;
  password: string;
  token: string;
}

export async function createHarness(prefix: string) {
  const tag = `${prefix}-${Date.now()}`;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ bodyParser: false });
  configureBodyParsers(app);
  app.getHttpAdapter().getInstance().set("trust proxy", true);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const prisma = app.get(PrismaService);

  let ip = 0;
  const base = Math.floor(Math.random() * 200) + 20;
  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  // /auth/* is throttled per IP (5/min); every login gets its own forwarded IP.
  const login = (email: string, password: string) =>
    http().post("/auth/login").set("X-Forwarded-For", `10.${base}.${Math.floor(++ip / 250)}.${ip % 250}`).send({ email, password });

  const adminEmail = `${tag}-admin@illyriangym.dev`;
  const adminPassword = "AdminPassword123";
  const adminUser = await prisma.client.user.create({
    data: { email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 4), firstName: "E2E", lastName: "Admin", role: "ADMIN" },
  });
  const adminRes = await login(adminEmail, adminPassword);
  const admin: Account = { id: adminUser.id, email: adminEmail, password: adminPassword, token: adminRes.body.tokens.accessToken };

  const emails: string[] = [adminEmail];

  /**
   * Accounts created by staff start with a temporary password and must change it before using anything else
   * (the real flow is covered in account-workflow.e2e-spec). Most suites are about other things, so they mark
   * the account as already activated.
   */
  const activate = (userId: string) => prisma.client.user.update({ where: { id: userId }, data: { mustChangePassword: false } });

  async function createTrainer(label: string): Promise<Account> {
    const email = `${tag}-${label}@illyriangym.dev`;
    emails.push(email);
    const res = await http().post("/coaches").set(as(admin.token)).send({ email, firstName: label, lastName: "Trainer" });
    if (res.status !== 201) throw new Error(`createTrainer failed: ${res.status} ${JSON.stringify(res.body)}`);
    const password = res.body.temporaryPassword as string;
    const userId = (res.body.coach.userId ?? res.body.user?.id) as string;
    await activate(userId);
    const session = await login(email, password);
    return { id: userId, coachId: res.body.coach.id, email, password, token: session.body.tokens.accessToken };
  }

  async function createReceptionist(label: string): Promise<Account> {
    const email = `${tag}-${label}@illyriangym.dev`;
    emails.push(email);
    const res = await http().post("/admin/staff").set(as(admin.token)).send({ email, firstName: label, lastName: "Reception" });
    if (res.status !== 201) throw new Error(`createReceptionist failed: ${res.status} ${JSON.stringify(res.body)}`);
    const password = res.body.temporaryPassword as string;
    await activate(res.body.staff.id);
    const session = await login(email, password);
    return { id: res.body.staff.id, email, password, token: session.body.tokens.accessToken };
  }

  /** Creates a member; by default with a 30-day PAID membership so they can book. */
  async function createMember(label: string, opts: { membership?: boolean } = {}): Promise<Account> {
    const email = `${tag}-${label}@illyriangym.dev`;
    emails.push(email);
    const res = await http().post("/admin/members").set(as(admin.token)).send({ email, firstName: label, lastName: "Member" });
    if (res.status !== 201) throw new Error(`createMember failed: ${res.status} ${JSON.stringify(res.body)}`);
    const id = res.body.member.id as string;
    if (opts.membership !== false) await assignMembership(id);
    await activate(id);
    const password = res.body.temporaryPassword as string;
    const session = await login(email, password);
    return { id, email, password, token: session.body.tokens.accessToken };
  }

  let planId: string | undefined;
  async function assignMembership(userId: string, days = 30) {
    if (!planId) {
      const plan = await http().post("/membership-plans").set(as(admin.token)).send({ name: `${tag} plan`, durationDays: 30 });
      planId = plan.body.id;
    }
    const res = await http()
      .post("/admin/memberships")
      .set(as(admin.token))
      .send({ userId, planId, startDate: new Date().toISOString(), endDate: new Date(Date.now() + days * 86_400_000).toISOString(), paymentStatus: "PAID" });
    if (res.status !== 201) throw new Error(`assignMembership failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  }

  /** A class starting `startInHours` from now, one hour long. */
  /** A membership plan with a price (cents). The default plan used by `assignMembership` has no price. */
  async function createPricedPlan(priceCents: number, extra: Record<string, unknown> = {}) {
    const res = await http()
      .post("/membership-plans")
      .set(as(admin.token))
      .send({ name: `${tag} plan ${priceCents}-${Math.random().toString(36).slice(2, 6)}`, durationDays: 30, priceCents, planType: "COMBINED", period: "MONTHLY", ...extra });
    if (res.status !== 201) throw new Error(`createPricedPlan failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { id: string; name: string; priceCents: number };
  }

  async function createClass(coachId: string | undefined, capacity: number, startInHours = 24, title = `${tag} class`) {
    const start = Date.now() + startInHours * 3_600_000;
    const res = await http()
      .post("/classes")
      .set(as(admin.token))
      .send({ title, coachId, startTime: new Date(start).toISOString(), endTime: new Date(start + 3_600_000).toISOString(), capacity });
    if (res.status !== 201) throw new Error(`createClass failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { id: string; capacity: number; bookedCount: number };
  }

  async function cleanup() {
    const db = prisma.client;
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] } });
    // Money and visits reference users with onDelete: Restrict, so they must go first.
    await db.payment.deleteMany({ where: { userId: { in: ids } } });
    await db.invoice.deleteMany({ where: { userId: { in: ids } } });
    await db.expense.deleteMany({ where: { description: { startsWith: tag } } });
    await db.promotion.deleteMany({ where: { name: { startsWith: tag } } });
    await db.message.deleteMany({ where: { subject: { startsWith: tag } } });
    await db.announcement.deleteMany({ where: { title: { startsWith: tag } } });
    await db.challenge.deleteMany({ where: { title: { startsWith: tag } } });
    await db.wod.deleteMany({ where: { title: { startsWith: tag } } });
    await db.class.deleteMany({ where: { title: { startsWith: tag } } });
    await db.exercise.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.membershipPlan.deleteMany({ where: { name: { startsWith: tag } } });
    await app.close();
  }

  return { app, prisma, tag, http, as, login, admin, activate, createTrainer, createReceptionist, createMember, assignMembership, createPricedPlan, createClass, cleanup };
}
