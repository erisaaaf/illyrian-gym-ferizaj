import { createHarness } from "./support/harness";

/**
 * The trainer (COACH) experience: a trainer manages only their own classes,
 * checks members in, writes WODs, and verifies PRs - and cannot reach into a
 * colleague's classes or any Admin-only function.
 */
describe("Trainer flow (e2e)", () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  let alice: Awaited<ReturnType<typeof h.createTrainer>>;
  let bob: Awaited<ReturnType<typeof h.createTrainer>>;
  let member: Awaited<ReturnType<typeof h.createMember>>;
  let aliceClass: { id: string };
  let bobClass: { id: string };
  let squatId: string;

  beforeAll(async () => {
    h = await createHarness("e2e-trn");
    alice = await h.createTrainer("alice");
    bob = await h.createTrainer("bob");
    member = await h.createMember("member");
    squatId = (await h.prisma.client.exercise.findFirstOrThrow({ where: { name: "Back Squat" } })).id;
    aliceClass = await h.createClass(alice.coachId, 10, 1, `${h.tag} alice class`);
    bobClass = await h.createClass(bob.coachId, 10, 1, `${h.tag} bob class`);
    await h.http().post("/bookings").set(h.as(member.token)).send({ classId: aliceClass.id });
    await h.http().post("/bookings").set(h.as(member.token)).send({ classId: bobClass.id });
  });
  afterAll(async () => h.cleanup());

  describe("Own classes", () => {
    it("sees their profile and the participants of their own class", async () => {
      expect((await h.http().get("/coaches/me").set(h.as(alice.token))).body.id).toBe(alice.coachId);
      const res = await h.http().get(`/classes/${aliceClass.id}/participants`).set(h.as(alice.token));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("cannot see participants of a colleague's class (admin can)", async () => {
      expect((await h.http().get(`/classes/${bobClass.id}/participants`).set(h.as(alice.token))).status).toBe(403);
      expect((await h.http().get(`/classes/${bobClass.id}/participants`).set(h.as(h.admin.token))).status).toBe(200);
    });

    it("returns 404 for a class that does not exist", async () => {
      expect((await h.http().get("/classes/00000000-0000-4000-8000-000000000000/participants").set(h.as(alice.token))).status).toBe(404);
    });
  });

  describe("Check-in", () => {
    it("checks a member in to their own class, recording who did it", async () => {
      const res = await h.http().post("/admin/attendance").set(h.as(alice.token)).send({ userId: member.id, classId: aliceClass.id, status: "CHECKED_IN" });
      expect(res.status).toBe(201);
      expect(res.body.markedById).toBe(alice.id);
      const booking = await h.prisma.client.booking.findFirstOrThrow({ where: { userId: member.id, classId: aliceClass.id } });
      expect(booking.status).toBe("ATTENDED");
    });

    it("cannot mark attendance for a colleague's class", async () => {
      const res = await h.http().post("/admin/attendance").set(h.as(alice.token)).send({ userId: member.id, classId: bobClass.id, status: "CHECKED_IN" });
      expect(res.status).toBe(403);
      expect(await h.prisma.client.attendance.count({ where: { classId: bobClass.id } })).toBe(0);
    });

    it("only sees attendance records for their own classes", async () => {
      await h.http().post("/admin/attendance").set(h.as(bob.token)).send({ userId: member.id, classId: bobClass.id, status: "CHECKED_IN" });
      const alices = await h.http().get("/admin/attendance").set(h.as(alice.token));
      expect(alices.body.data.every((a: { classId: string }) => a.classId === aliceClass.id)).toBe(true);
      expect(alices.body.data.length).toBeGreaterThan(0);
      const all = await h.http().get("/admin/attendance?pageSize=100").set(h.as(h.admin.token));
      const ids = new Set(all.body.data.map((a: { classId: string }) => a.classId));
      expect(ids.has(aliceClass.id) && ids.has(bobClass.id)).toBe(true);
    });

    it("checking someone in earns challenge points only on the first check-in", async () => {
      const m = await h.createMember("points");
      const cls = await h.createClass(alice.coachId, 5, 1, `${h.tag} points class`);
      await h.http().post("/bookings").set(h.as(m.token)).send({ classId: cls.id });
      const challenge = await h.http().post("/challenges").set(h.as(h.admin.token)).send({
        title: `${h.tag} trainer challenge`,
        startDate: new Date(Date.now() - 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 86_400_000 * 5).toISOString(),
      });
      await h.http().patch(`/challenges/${challenge.body.id}`).set(h.as(h.admin.token)).send({ status: "ACTIVE" });
      await h.http().post(`/challenges/${challenge.body.id}/join`).set(h.as(m.token));

      const checkIn = () => h.http().post("/admin/attendance").set(h.as(alice.token)).send({ userId: m.id, classId: cls.id, status: "CHECKED_IN" });
      await checkIn();
      await checkIn(); // idempotent re-submit must not double-count
      const points = async () => (await h.prisma.client.challengeParticipant.findFirstOrThrow({ where: { userId: m.id } })).points;
      expect(await points()).toBe(1);

      // correcting to no-show and back is a fresh check-in
      await h.http().post("/admin/attendance").set(h.as(alice.token)).send({ userId: m.id, classId: cls.id, status: "NO_SHOW" });
      await checkIn();
      expect(await points()).toBe(2);
    });

    it("validates the payload", async () => {
      expect((await h.http().post("/admin/attendance").set(h.as(alice.token)).send({ classId: aliceClass.id })).status).toBe(400);
      expect((await h.http().post("/admin/attendance").set(h.as(alice.token)).send({ userId: member.id, classId: aliceClass.id, status: "ATTENDED" })).status).toBe(400);
    });
  });

  describe("WODs", () => {
    it("writes a WOD as a draft, publishes it, and members then see it", async () => {
      const created = await h.http().post("/wods").set(h.as(alice.token)).send({
        title: `${h.tag} trainer wod`,
        date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
        type: "FOR_TIME",
        sections: [{ type: "METCON", order: 1, exercises: [{ exerciseId: squatId, order: 1, reps: 21 }] }],
      });
      expect(created.status).toBe(201);
      expect(created.body.createdById).toBe(alice.id);
      expect((await h.http().get(`/wods/${created.body.id}`).set(h.as(member.token))).status).toBe(404);

      expect((await h.http().patch(`/wods/${created.body.id}/publish`).set(h.as(alice.token))).status).toBe(200);
      expect((await h.http().get(`/wods/${created.body.id}`).set(h.as(member.token))).status).toBe(200);
      expect((await h.http().get(`/wods/${created.body.id}`).set(h.as(bob.token))).status).toBe(200);
    });
  });

  describe("PRs", () => {
    it("cannot touch the PRs of a member who is not their client", async () => {
      const stranger = await h.createMember("not-mine");
      const res = await h.http().post("/admin/prs/manual").set(h.as(alice.token)).send({ userId: stranger.id, exerciseId: squatId, value: 100, achievedAt: new Date().toISOString(), reason: "x" });
      expect(res.status).toBe(404); // hides whether the member exists
      expect((await h.http().get(`/admin/prs?userId=${stranger.id}`).set(h.as(alice.token))).body.data).toHaveLength(0);
    });

    it("adds a manual PR with a reason, verifies and corrects it (audited)", async () => {
      const m = await h.createMember("prmember");
      await h.http().patch(`/admin/members/${m.id}`).set(h.as(h.admin.token)).send({ assignedCoachId: alice.coachId }); // now alice's client
      const manual = await h.http().post("/admin/prs/manual").set(h.as(alice.token)).send({ userId: m.id, exerciseId: squatId, value: 110, achievedAt: new Date().toISOString(), reason: "Saw it in class" });
      expect(manual.status).toBe(201);
      const id = manual.body.id;
      expect((await h.http().patch(`/admin/prs/${id}/verify`).set(h.as(alice.token))).status).toBe(200);
      expect((await h.http().patch(`/admin/prs/${id}/correct`).set(h.as(alice.token))
        .send({ value: 112.5, achievedAt: new Date().toISOString(), reason: "Re-weighed the bar" })).status).toBe(200);
      const actions = (await h.prisma.client.auditLog.findMany({ where: { entityId: id, actorId: alice.id } })).map((a) => a.action).sort();
      expect(actions).toEqual(["pr.correct", "pr.manual_add", "pr.verify"]);

      // the member sees the verified, corrected value
      const mine = await h.http().get("/prs/me").set(h.as(m.token));
      expect(Number(mine.body[0].value)).toBe(112.5);
      expect(mine.body[0].verificationStatus).toBe("VERIFIED");
    });

    it("rejects a correction without a reason", async () => {
      const m = await h.createMember("noreason");
      await h.http().patch(`/admin/members/${m.id}`).set(h.as(h.admin.token)).send({ assignedCoachId: alice.coachId });
      const manual = await h.http().post("/admin/prs/manual").set(h.as(alice.token)).send({ userId: m.id, exerciseId: squatId, value: 50, achievedAt: new Date().toISOString(), reason: "x" });
      const res = await h.http().patch(`/admin/prs/${manual.body.id}/correct`).set(h.as(alice.token)).send({ value: 60, achievedAt: new Date().toISOString() });
      expect(res.status).toBe(400);
    });
  });

  describe("Boundaries", () => {
    it.each([
      ["create a class", () => h.http().post("/classes").set(h.as(alice.token)).send({})],
      ["cancel a class", () => h.http().patch(`/classes/${aliceClass.id}/cancel`).set(h.as(alice.token))],
      ["cancel a booking as admin", () => h.http().get("/admin/bookings").set(h.as(alice.token))],
      ["manage announcements", () => h.http().post("/announcements").set(h.as(alice.token)).send({ title: "x", content: "y" })],
      ["manage challenges", () => h.http().post("/challenges").set(h.as(alice.token)).send({ title: "x" })],
      ["manage exercises", () => h.http().post("/exercises").set(h.as(alice.token)).send({ name: "x", category: "OTHER", measurementType: "REPS" })],
      ["list members", () => h.http().get("/admin/members").set(h.as(alice.token))],
      ["edit another trainer", () => h.http().patch(`/coaches/${bob.coachId}`).set(h.as(alice.token)).send({ bio: "hacked" })],
      ["reset another trainer's password", () => h.http().post(`/coaches/${bob.coachId}/reset-password`).set(h.as(alice.token))],
    ])("is forbidden to %s", async (_label, call) => {
      expect((await call()).status).toBe(403);
    });

    it("cannot read business analytics, finance or reports (owner only)", async () => {
      for (const path of ["/admin/analytics/overview", "/admin/reports/dashboard", "/admin/finance/summary", "/admin/expenses", "/admin/staff", "/admin/payments", "/admin/invoices", "/admin/check-in/today"]) {
        expect((await h.http().get(path).set(h.as(alice.token))).status).toBe(403);
      }
    });

    it("a deactivated trainer loses access immediately", async () => {
      const temp = await h.createTrainer("temp");
      expect((await h.http().get("/coaches/me").set(h.as(temp.token))).status).toBe(200);
      await h.http().patch(`/coaches/${temp.coachId}/deactivate`).set(h.as(h.admin.token));
      expect((await h.http().get("/coaches/me").set(h.as(temp.token))).status).toBe(401);
    });
  });
});
