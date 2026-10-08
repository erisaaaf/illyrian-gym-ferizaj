import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcryptjs";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * The real account workflow, against a real database:
 *   Admin logs in -> Admin creates a trainer / a member -> they log in with the
 *   generated credentials -> RBAC keeps each role in its lane.
 * Needs DATABASE_URL pointing at a disposable database (see docs/testing.md).
 */
describe("Admin-managed accounts (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const adminEmail = `e2e-admin-${stamp}@illyriangym.dev`;
  const adminPassword = "AdminPassword123";
  const trainerEmail = `e2e-trainer-${stamp}@illyriangym.dev`;
  const memberEmail = `e2e-member-${stamp}@illyriangym.dev`;

  let adminToken: string;
  let trainerToken: string;
  let trainerPassword: string;
  let trainerCoachId: string;
  let trainerRefreshToken: string;
  let memberToken: string;
  let memberPassword: string;
  let memberId: string;
  let classId: string;
  let ipCounter = 0;

  // /auth/* is throttled per client IP (5/min); give each login its own
  // forwarded IP so one test run doesn't trip the limiter against itself.
  const login = (email: string, password: string) =>
    request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Forwarded-For", `10.1.0.${++ipCounter}`)
      .send({ email, password });

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set("trust proxy", true);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.client.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 4),
        firstName: "E2E",
        lastName: "Admin",
        role: "ADMIN",
      },
    });
  });

  afterAll(async () => {
    // Leave the dev database as we found it: users cascade to their coach
    // profile, memberships, bookings and sessions; then drop what they pointed at.
    await prisma.client.user.deleteMany({ where: { email: { in: [adminEmail, trainerEmail, memberEmail] } } });
    await prisma.client.class.deleteMany({ where: { title: "E2E class" } });
    await prisma.client.membershipPlan.deleteMany({ where: { name: `E2E plan ${stamp}` } });
    await app.close();
  });

  it("admin can log in", async () => {
    const res = await login(adminEmail, adminPassword);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("ADMIN");
    adminToken = res.body.tokens.accessToken;
  });

  it("does not allow public self-registration (accounts come from the Admin)", async () => {
    const res = await http()
      .post("/auth/register")
      .set("X-Forwarded-For", "10.9.0.1")
      .send({ email: `selfreg-${stamp}@illyriangym.dev`, password: "Password123", firstName: "Self", lastName: "Reg" });
    expect(res.status).toBe(403);
    expect(await prisma.client.user.findUnique({ where: { email: `selfreg-${stamp}@illyriangym.dev` } })).toBeNull();
  });

  describe("Add Trainer", () => {
    it("creates a COACH user and a linked Coach profile and returns credentials once", async () => {
      const res = await http()
        .post("/coaches")
        .set(as(adminToken))
        .send({ email: trainerEmail, firstName: "Test", lastName: "Trainer", specialties: ["Mobility"], certifications: ["Entered by admin"] });

      expect(res.status).toBe(201);
      expect(res.body.temporaryPassword).toEqual(expect.any(String));
      expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(12);
      trainerPassword = res.body.temporaryPassword;
      trainerCoachId = res.body.coach.id;

      const user = await prisma.client.user.findUniqueOrThrow({ where: { email: trainerEmail }, include: { coach: true } });
      expect(user.role).toBe("COACH");
      expect(user.coach?.id).toBe(trainerCoachId);
      expect(user.passwordHash).not.toContain(trainerPassword);
    });

    it("rejects a duplicate email", async () => {
      const res = await http().post("/coaches").set(as(adminToken)).send({ email: trainerEmail, firstName: "Dup", lastName: "Trainer" });
      expect(res.status).toBe(409);
    });

    it("trainer can log in with the generated credentials", async () => {
      const res = await login(trainerEmail, trainerPassword);
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("COACH");
      trainerToken = res.body.tokens.accessToken;
      trainerRefreshToken = res.body.tokens.refreshToken;
    });
  });

  describe("Trainer permissions (no admin powers)", () => {
    it.each([
      ["create a trainer", () => http().post("/coaches").set(as(trainerToken)).send({ email: "x@y.dev", firstName: "X", lastName: "Y" })],
      ["list members", () => http().get("/admin/members").set(as(trainerToken))],
      ["create a member", () => http().post("/admin/members").set(as(trainerToken)).send({ email: "x@y.dev", firstName: "X", lastName: "Y" })],
      ["assign a membership", () => http().post("/admin/memberships").set(as(trainerToken)).send({})],
      ["create a class", () => http().post("/classes").set(as(trainerToken)).send({})],
      ["deactivate a coach", () => http().patch(`/coaches/${trainerCoachId}/deactivate`).set(as(trainerToken))],
      ["edit gym settings", () => http().patch("/admin/settings/gym").set(as(trainerToken)).send({ name: "Hacked" })],
    ])("is forbidden to %s", async (_label, call) => {
      expect((await call()).status).toBe(403);
    });

    it("can use the staff endpoints a coach is meant to have", async () => {
      expect((await http().get("/coaches/me").set(as(trainerToken))).status).toBe(200);
      expect((await http().get("/admin/analytics/overview").set(as(trainerToken))).status).toBe(200);
      expect((await http().get("/admin/prs").set(as(trainerToken))).status).toBe(200);
    });
  });

  describe("Add Member + Assign Membership", () => {
    it("creates a MEMBER user and returns credentials once", async () => {
      const res = await http().post("/admin/members").set(as(adminToken)).send({ email: memberEmail, firstName: "Test", lastName: "Member" });
      expect(res.status).toBe(201);
      memberPassword = res.body.temporaryPassword;
      memberId = res.body.member.id;
      expect(memberPassword).toEqual(expect.any(String));

      const user = await prisma.client.user.findUniqueOrThrow({ where: { email: memberEmail } });
      expect(user.role).toBe("MEMBER");
    });

    it("member can log in with the generated credentials, but cannot book without a membership", async () => {
      const res = await login(memberEmail, memberPassword);
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("MEMBER");
      memberToken = res.body.tokens.accessToken;

      const cls = await http()
        .post("/classes")
        .set(as(adminToken))
        .send({
          title: "E2E class",
          coachId: trainerCoachId,
          startTime: new Date(Date.now() + 86_400_000).toISOString(),
          endTime: new Date(Date.now() + 90_000_000).toISOString(),
          capacity: 1,
        });
      expect(cls.status).toBe(201);
      expect(cls.body.coach.id).toBe(trainerCoachId);

      const booking = await http().post("/bookings").set(as(memberToken)).send({ classId: cls.body.id });
      expect(booking.status).toBe(403);
      classId = cls.body.id;
    });

    it("admin assigns a membership and the member can then book", async () => {
      const plan = await http().post("/membership-plans").set(as(adminToken)).send({ name: `E2E plan ${stamp}`, durationDays: 30 });
      expect(plan.status).toBe(201);
      expect(plan.body.priceCents).toBeNull();

      const membership = await http()
        .post("/admin/memberships")
        .set(as(adminToken))
        .send({
          userId: memberId,
          planId: plan.body.id,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          paymentStatus: "PAID",
        });
      expect(membership.status).toBe(201);
      expect(membership.body.computedStatus).toBe("ACTIVE");

      const mine = await http().get("/memberships/me").set(as(memberToken));
      expect(mine.status).toBe(200);
      expect(mine.body.computedStatus).toBe("ACTIVE");

      const booking = await http().post("/bookings").set(as(memberToken)).send({ classId });
      expect(booking.status).toBe(201);
      expect(booking.body.status).toBe("BOOKED");

      const participants = await http().get(`/classes/${classId}/participants`).set(as(trainerToken));
      expect(participants.status).toBe(200);
      expect(participants.body).toHaveLength(1);
    });
  });

  describe("Member permissions (own data only)", () => {
    it.each([
      ["list members", () => http().get("/admin/members").set(as(memberToken))],
      ["create a trainer", () => http().post("/coaches").set(as(memberToken)).send({ email: "x@y.dev", firstName: "X", lastName: "Y" })],
      ["view analytics", () => http().get("/admin/analytics/overview").set(as(memberToken))],
      ["view class participants", () => http().get(`/classes/${classId}/participants`).set(as(memberToken))],
      ["verify a PR", () => http().patch("/admin/prs/00000000-0000-0000-0000-000000000000/verify").set(as(memberToken))],
    ])("is forbidden to %s", async (_label, call) => {
      expect((await call()).status).toBe(403);
    });

    it("cannot read or log another account's data via /users/me", async () => {
      const res = await http().get("/users/me").set(as(memberToken));
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(memberEmail);
    });
  });

  describe("Deactivate / reactivate", () => {
    it("deactivating a trainer cuts off their live token, login and refresh immediately", async () => {
      const off = await http().patch(`/coaches/${trainerCoachId}/deactivate`).set(as(adminToken));
      expect(off.status).toBe(200);

      expect((await http().get("/coaches/me").set(as(trainerToken))).status).toBe(401);
      expect((await login(trainerEmail, trainerPassword)).status).toBe(401);
      expect((await http().post("/auth/refresh").send({ refreshToken: trainerRefreshToken })).status).toBe(401);
    });

    it("reactivating restores access", async () => {
      const on = await http().patch(`/coaches/${trainerCoachId}/reactivate`).set(as(adminToken));
      expect(on.status).toBe(200);
      expect((await login(trainerEmail, trainerPassword)).status).toBe(200);
    });

    it("suspending a member blocks them, and admin can reactivate them", async () => {
      expect((await http().patch(`/admin/members/${memberId}/status`).set(as(adminToken)).send({ status: "SUSPENDED" })).status).toBe(200);
      expect((await http().get("/memberships/me").set(as(memberToken))).status).toBe(401);
      expect((await http().patch(`/admin/members/${memberId}/status`).set(as(adminToken)).send({ status: "ACTIVE" })).status).toBe(200);
      expect((await http().get("/memberships/me").set(as(memberToken))).status).toBe(200);
    });
  });

  describe("Admin password reset", () => {
    it("issues a new one-time password, kills the old one and revokes sessions", async () => {
      const res = await http().post(`/admin/members/${memberId}/reset-password`).set(as(adminToken));
      expect(res.status).toBe(200);
      const newPassword = res.body.temporaryPassword;
      expect(newPassword).not.toBe(memberPassword);

      expect((await login(memberEmail, memberPassword)).status).toBe(401);
      expect((await login(memberEmail, newPassword)).status).toBe(200);
    });
  });
});
