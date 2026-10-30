import { createHarness } from "./support/harness";

/**
 * Every Admin action, end to end: HTTP -> service -> PostgreSQL, then read back
 * from the database (not just the response) and, where sensitive, check the
 * audit log. Also checks members actually see what the Admin publishes.
 */
describe("Admin management (e2e)", () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  let trainer: Awaited<ReturnType<typeof h.createTrainer>>;
  let member: Awaited<ReturnType<typeof h.createMember>>;
  let squatId: string;

  const audit = (action: string, entityId: string) => h.prisma.client.auditLog.findFirst({ where: { action, entityId } });

  beforeAll(async () => {
    h = await createHarness("e2e-adm");
    trainer = await h.createTrainer("trainer");
    member = await h.createMember("member");
    squatId = (await h.prisma.client.exercise.findFirstOrThrow({ where: { name: "Back Squat" } })).id;
  });
  afterAll(async () => h.cleanup());

  describe("Trainers", () => {
    it("edits a trainer profile and persists it", async () => {
      const res = await h.http().patch(`/coaches/${trainer.coachId}`).set(h.as(h.admin.token)).send({ bio: "Updated bio", specialties: ["Olympic lifting"] });
      expect(res.status).toBe(200);
      const row = await h.prisma.client.coach.findUniqueOrThrow({ where: { id: trainer.coachId } });
      expect(row.bio).toBe("Updated bio");
      expect(row.specialties).toEqual(["Olympic lifting"]);
    });

    it("lists and fetches trainers", async () => {
      const list = await h.http().get("/coaches?pageSize=100").set(h.as(h.admin.token));
      expect(list.status).toBe(200);
      expect(list.body.data.some((c: { id: string }) => c.id === trainer.coachId)).toBe(true);
      expect((await h.http().get(`/coaches/${trainer.coachId}`).set(h.as(h.admin.token))).status).toBe(200);
    });

    it("reset-password issues a new password once and audits it without leaking it", async () => {
      const res = await h.http().post(`/coaches/${trainer.coachId}/reset-password`).set(h.as(h.admin.token));
      expect(res.status).toBe(200);
      const entries = await h.prisma.client.auditLog.findMany({ where: { actorId: h.admin.id, action: { contains: "reset" } } });
      expect(entries.length).toBeGreaterThan(0);
      expect(JSON.stringify(entries)).not.toContain(res.body.temporaryPassword);
      trainer.password = res.body.temporaryPassword;

      // A reset puts the account back into "must choose a new password": nothing else works until they do.
      const session = await h.login(trainer.email, trainer.password);
      expect(session.body.user.mustChangePassword).toBe(true);
      const blocked = await h.http().get("/coaches/me").set(h.as(session.body.tokens.accessToken));
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      const changed = await h.http().post("/auth/change-password").set(h.as(session.body.tokens.accessToken)).send({ currentPassword: trainer.password, newPassword: "ChosenByTrainer123" });
      expect(changed.status).toBe(200);
      trainer.password = "ChosenByTrainer123";
      trainer.token = (await h.login(trainer.email, trainer.password)).body.tokens.accessToken;
      expect((await h.http().get("/coaches/me").set(h.as(trainer.token))).status).toBe(200);
    });
  });

  describe("Members", () => {
    it("lists members with search and status filters", async () => {
      const res = await h.http().get(`/admin/members?search=${encodeURIComponent(member.email)}`).set(h.as(h.admin.token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBe(member.email);

      const suspended = await h.http().get(`/admin/members?search=${encodeURIComponent(member.email)}&status=SUSPENDED`).set(h.as(h.admin.token));
      expect(suspended.body.data).toHaveLength(0);
    });

    it("edits a member and persists the change", async () => {
      const res = await h.http().patch(`/admin/members/${member.id}`).set(h.as(h.admin.token)).send({ firstName: "Renamed", phone: "+38344000000" });
      expect(res.status).toBe(200);
      const row = await h.prisma.client.user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.firstName).toBe("Renamed");
      expect(row.phone).toBe("+38344000000");
    });

    it("validates input (bad email rejected, role cannot be changed)", async () => {
      expect((await h.http().post("/admin/members").set(h.as(h.admin.token)).send({ email: "nope", firstName: "A", lastName: "B" })).status).toBe(400);
      expect((await h.http().patch(`/admin/members/${member.id}`).set(h.as(h.admin.token)).send({ role: "ADMIN" })).status).toBe(400);
    });
  });

  describe("Memberships", () => {
    it("edits dates/payment status and persists it", async () => {
      const current = await h.prisma.client.membership.findFirstOrThrow({ where: { userId: member.id } });
      const newEnd = new Date(Date.now() + 60 * 86_400_000).toISOString();
      const res = await h.http().patch(`/admin/memberships/${current.id}`).set(h.as(h.admin.token)).send({ endDate: newEnd, paymentStatus: "PARTIAL" });
      expect(res.status).toBe(200);
      const row = await h.prisma.client.membership.findUniqueOrThrow({ where: { id: current.id } });
      expect(row.paymentStatus).toBe("PARTIAL");
      expect(row.endDate.toISOString()).toBe(newEnd);
    });

    it("rejects an end date before the start date", async () => {
      const current = await h.prisma.client.membership.findFirstOrThrow({ where: { userId: member.id } });
      const res = await h.http().patch(`/admin/memberships/${current.id}`).set(h.as(h.admin.token)).send({ endDate: new Date(Date.now() - 400 * 86_400_000).toISOString() });
      expect(res.status).toBe(400);
    });

    it("cancel blocks booking; a fresh membership restores it", async () => {
      const m = await h.createMember("cancelme");
      const cls = await h.createClass(trainer.coachId, 5);
      const membership = await h.prisma.client.membership.findFirstOrThrow({ where: { userId: m.id } });

      const cancel = await h.http().patch(`/admin/memberships/${membership.id}/cancel`).set(h.as(h.admin.token));
      expect(cancel.status).toBe(200);
      expect((await h.http().post("/bookings").set(h.as(m.token)).send({ classId: cls.id })).status).toBe(403);

      await h.assignMembership(m.id);
      expect((await h.http().post("/bookings").set(h.as(m.token)).send({ classId: cls.id })).status).toBe(201);
    });

    it("lists memberships by computed status", async () => {
      const res = await h.http().get("/admin/memberships?status=ACTIVE").set(h.as(h.admin.token));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("creates and edits membership plans", async () => {
      const plan = await h.http().post("/membership-plans").set(h.as(h.admin.token)).send({ name: `${h.tag} plan B`, durationDays: 90, priceCents: 5000 });
      expect(plan.status).toBe(201);
      const upd = await h.http().patch(`/membership-plans/${plan.body.id}`).set(h.as(h.admin.token)).send({ isActive: false });
      expect(upd.status).toBe(200);
      expect((await h.prisma.client.membershipPlan.findUniqueOrThrow({ where: { id: plan.body.id } })).isActive).toBe(false);
    });
  });

  describe("Classes", () => {
    let classId: string;

    it("creates, edits and persists a class; rejects bad times and capacity", async () => {
      const start = Date.now() + 2 * 86_400_000;
      const bad = await h.http().post("/classes").set(h.as(h.admin.token)).send({ title: `${h.tag} bad`, startTime: new Date(start).toISOString(), endTime: new Date(start - 3_600_000).toISOString(), capacity: 5 });
      expect(bad.status).toBe(400);
      const zero = await h.http().post("/classes").set(h.as(h.admin.token)).send({ title: `${h.tag} bad`, startTime: new Date(start).toISOString(), endTime: new Date(start + 3_600_000).toISOString(), capacity: 0 });
      expect(zero.status).toBe(400);

      const cls = await h.createClass(trainer.coachId, 8, 48, `${h.tag} editable`);
      classId = cls.id;
      const upd = await h.http().patch(`/classes/${classId}`).set(h.as(h.admin.token)).send({ title: `${h.tag} renamed`, capacity: 12 });
      expect(upd.status).toBe(200);
      const row = await h.prisma.client.class.findUniqueOrThrow({ where: { id: classId } });
      expect(row.title).toBe(`${h.tag} renamed`);
      expect(row.capacity).toBe(12);
    });

    it("cannot reduce capacity below the number already booked", async () => {
      expect((await h.http().post("/bookings").set(h.as(member.token)).send({ classId })).status).toBe(201);
      const res = await h.http().patch(`/classes/${classId}`).set(h.as(h.admin.token)).send({ capacity: 1 });
      // one booked, capacity 1 is allowed; capacity below the booked count is not
      expect(res.status).toBe(200);
      const other = await h.createMember("cap-other");
      await h.http().post("/bookings").set(h.as(other.token)).send({ classId });
      const tooLow = await h.http().patch(`/classes/${classId}`).set(h.as(h.admin.token)).send({ capacity: 0 });
      expect(tooLow.status).toBe(400);
    });

    it("cancelling a class cancels its bookings and blocks new ones", async () => {
      const cancel = await h.http().patch(`/classes/${classId}/cancel`).set(h.as(h.admin.token));
      expect(cancel.status).toBe(200);
      const row = await h.prisma.client.class.findUniqueOrThrow({ where: { id: classId } });
      expect(row.status).toBe("CANCELLED");
      const bookings = await h.prisma.client.booking.findMany({ where: { classId } });
      expect(bookings.length).toBeGreaterThan(0);
      expect(bookings.every((b) => b.status === "CANCELLED")).toBe(true);
      expect((await h.http().post("/bookings").set(h.as(member.token)).send({ classId })).status).toBe(400);
    });
  });

  describe("Bookings", () => {
    it("lists with filters, and admin cancel promotes the waitlist", async () => {
      const a = await h.createMember("book-a");
      const b = await h.createMember("book-b");
      const cls = await h.createClass(trainer.coachId, 1);
      const first = await h.http().post("/bookings").set(h.as(a.token)).send({ classId: cls.id });
      const second = await h.http().post("/bookings").set(h.as(b.token)).send({ classId: cls.id });
      expect(first.body.status).toBe("BOOKED");
      expect(second.body.status).toBe("WAITLISTED");

      const filtered = await h.http().get(`/admin/bookings?classId=${cls.id}&search=book-a`).set(h.as(h.admin.token));
      expect(filtered.body.data).toHaveLength(1);
      const upcoming = await h.http().get(`/admin/bookings?classId=${cls.id}&upcoming=true`).set(h.as(h.admin.token));
      expect(upcoming.body.data).toHaveLength(2);

      const cancel = await h.http().patch(`/admin/bookings/${first.body.id}/cancel`).set(h.as(h.admin.token));
      expect(cancel.status).toBe(200);
      const promoted = await h.prisma.client.booking.findUniqueOrThrow({ where: { id: second.body.id } });
      expect(promoted.status).toBe("BOOKED");
      expect((await h.prisma.client.class.findUniqueOrThrow({ where: { id: cls.id } })).bookedCount).toBe(1);
      expect(await audit("booking.cancel", first.body.id)).not.toBeNull();
    });
  });

  describe("Exercises", () => {
    it("creates, edits, deactivates and reactivates; hides inactive from members", async () => {
      const name = `${h.tag} Sled Push`;
      const created = await h.http().post("/exercises").set(h.as(h.admin.token)).send({ name, category: "STRONGMAN", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Sled"] });
      expect(created.status).toBe(201);
      const id = created.body.id;
      expect((await h.http().post("/exercises").set(h.as(h.admin.token)).send({ name, category: "OTHER", measurementType: "REPS" })).status).toBe(409);

      expect((await h.http().patch(`/exercises/${id}`).set(h.as(h.admin.token)).send({ difficulty: "ADVANCED" })).status).toBe(200);
      expect((await h.prisma.client.exercise.findUniqueOrThrow({ where: { id } })).difficulty).toBe("ADVANCED");

      const listed = async () => (await h.http().get(`/exercises?pageSize=100&search=${encodeURIComponent(name)}`).set(h.as(member.token))).body.data.some((e: { id: string }) => e.id === id);
      expect(await listed()).toBe(true);
      expect((await h.http().patch(`/exercises/${id}/deactivate`).set(h.as(h.admin.token))).status).toBe(200);
      expect(await listed()).toBe(false);
      expect((await h.http().patch(`/exercises/${id}/reactivate`).set(h.as(h.admin.token))).status).toBe(200);
      expect(await listed()).toBe(true);
    });

    it("members cannot manage exercises", async () => {
      expect((await h.http().post("/exercises").set(h.as(member.token)).send({ name: "x", category: "OTHER", measurementType: "REPS" })).status).toBe(403);
    });
  });

  describe("WODs", () => {
    it("draft is hidden from members; publish shows it; unpublish and archive hide it", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const created = await h.http().post("/wods").set(h.as(h.admin.token)).send({
        title: `${h.tag} WOD`,
        date: today,
        type: "AMRAP",
        sections: [{ type: "STRENGTH", order: 1, notes: "Heavy", exercises: [{ exerciseId: squatId, order: 1, sets: 5, reps: 5 }] }],
      });
      expect(created.status).toBe(201);
      const id = created.body.id;
      expect(created.body.status).toBe("DRAFT");

      expect((await h.http().get(`/wods/${id}`).set(h.as(member.token))).status).toBe(404);
      expect((await h.http().patch(`/wods/${id}`).set(h.as(h.admin.token)).send({ title: `${h.tag} WOD v2` })).status).toBe(200);

      expect((await h.http().patch(`/wods/${id}/publish`).set(h.as(h.admin.token))).status).toBe(200);
      const seen = await h.http().get(`/wods/${id}`).set(h.as(member.token));
      expect(seen.status).toBe(200);
      expect(seen.body.sections[0].exercises[0].exercise.name).toBe("Back Squat");
      expect(await audit("wod.published", id)).not.toBeNull();

      expect((await h.http().patch(`/wods/${id}/unpublish`).set(h.as(h.admin.token))).status).toBe(200);
      expect((await h.http().get(`/wods/${id}`).set(h.as(member.token))).status).toBe(404);
      expect((await h.http().patch(`/wods/${id}/archive`).set(h.as(h.admin.token))).status).toBe(200);
      expect((await h.prisma.client.wod.findUniqueOrThrow({ where: { id } })).status).toBe("ARCHIVED");
    });
  });

  describe("Announcements", () => {
    it("draft is hidden; publish shows it to members; unpublish and archive hide it", async () => {
      const created = await h.http().post("/announcements").set(h.as(h.admin.token)).send({ title: `${h.tag} news`, content: "Gym closed Sunday", priority: "IMPORTANT" });
      expect(created.status).toBe(201);
      const id = created.body.id;
      const visible = async () => (await h.http().get("/announcements?pageSize=100").set(h.as(member.token))).body.data.some((a: { id: string }) => a.id === id);

      expect(await visible()).toBe(false);
      expect((await h.http().patch(`/announcements/${id}`).set(h.as(h.admin.token)).send({ content: "Gym closed Sunday 12th" })).status).toBe(200);
      expect((await h.http().patch(`/announcements/${id}/publish`).set(h.as(h.admin.token))).status).toBe(200);
      expect(await visible()).toBe(true);
      expect((await h.http().patch(`/announcements/${id}/unpublish`).set(h.as(h.admin.token))).status).toBe(200);
      expect(await visible()).toBe(false);
      expect((await h.http().patch(`/announcements/${id}/archive`).set(h.as(h.admin.token))).status).toBe(200);
      expect((await h.prisma.client.announcement.findUniqueOrThrow({ where: { id } })).status).toBe("ARCHIVED");
    });

    it("members cannot create announcements", async () => {
      expect((await h.http().post("/announcements").set(h.as(member.token)).send({ title: "x", content: "y" })).status).toBe(403);
    });
  });

  describe("Challenges", () => {
    it("create, edit, activate; members join; activity earns points; leaderboard ranks; completed is closed", async () => {
      const a = await h.createMember("chal-a");
      const b = await h.createMember("chal-b");
      const created = await h.http().post("/challenges").set(h.as(h.admin.token)).send({
        title: `${h.tag} challenge`,
        startDate: new Date(Date.now() - 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
      expect(created.status).toBe(201);
      const id = created.body.id;
      expect((await h.http().patch(`/challenges/${id}`).set(h.as(h.admin.token)).send({ rules: "Show up" })).status).toBe(200);
      expect((await h.http().patch(`/challenges/${id}`).set(h.as(h.admin.token)).send({ status: "ACTIVE" })).status).toBe(200);

      expect((await h.http().post(`/challenges/${id}/join`).set(h.as(a.token))).status).toBe(200);
      expect((await h.http().post(`/challenges/${id}/join`).set(h.as(a.token))).status).toBe(409);
      expect((await h.http().post(`/challenges/${id}/join`).set(h.as(b.token))).status).toBe(200);

      for (const [who, n] of [[a, 2], [b, 1]] as const) {
        for (let i = 0; i < n; i++) {
          expect((await h.http().post("/workouts").set(h.as(who.token)).send({ exerciseId: squatId, weightKg: 40 + i, reps: 5 })).status).toBe(201);
        }
      }
      const board = await h.http().get(`/challenges/${id}/leaderboard`).set(h.as(b.token));
      expect(board.status).toBe(200);
      expect(board.body.map((r: { points: number }) => r.points)).toEqual([2, 1]);

      expect((await h.http().patch(`/challenges/${id}`).set(h.as(h.admin.token)).send({ status: "COMPLETED" })).status).toBe(200);
      const late = await h.createMember("chal-late");
      expect((await h.http().post(`/challenges/${id}/join`).set(h.as(late.token))).status).toBe(400);
    });
  });

  describe("Attendance (admin)", () => {
    it("marks, corrects, records who marked it, syncs the booking, and filters", async () => {
      const m = await h.createMember("att");
      const cls = await h.createClass(trainer.coachId, 5, 1);
      const booking = await h.http().post("/bookings").set(h.as(m.token)).send({ classId: cls.id });

      const mark = await h.http().post("/admin/attendance").set(h.as(h.admin.token)).send({ userId: m.id, classId: cls.id, status: "CHECKED_IN" });
      expect(mark.status).toBe(201);
      expect(mark.body.markedById).toBe(h.admin.id);
      expect((await h.prisma.client.booking.findUniqueOrThrow({ where: { id: booking.body.id } })).status).toBe("ATTENDED");

      const fix = await h.http().post("/admin/attendance").set(h.as(h.admin.token)).send({ userId: m.id, classId: cls.id, status: "NO_SHOW" });
      expect(fix.status).toBe(201);
      expect((await h.prisma.client.booking.findUniqueOrThrow({ where: { id: booking.body.id } })).status).toBe("NO_SHOW");
      expect(await h.prisma.client.attendance.count({ where: { userId: m.id, classId: cls.id } })).toBe(1);
      expect(await audit("attendance.correct", fix.body.id)).not.toBeNull();

      // ...and the correction can be undone: back to checked in re-syncs the booking
      const undo = await h.http().post("/admin/attendance").set(h.as(h.admin.token)).send({ userId: m.id, classId: cls.id, status: "CHECKED_IN" });
      expect(undo.status).toBe(201);
      expect((await h.prisma.client.booking.findUniqueOrThrow({ where: { id: booking.body.id } })).status).toBe("ATTENDED");
      const redo = await h.http().post("/admin/attendance").set(h.as(h.admin.token)).send({ userId: m.id, classId: cls.id, status: "NO_SHOW" });
      expect(redo.status).toBe(201);

      const list = await h.http().get(`/admin/attendance?classId=${cls.id}`).set(h.as(h.admin.token));
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].status).toBe("NO_SHOW");

      const mine = await h.http().get("/attendance/me").set(h.as(m.token));
      expect(mine.body.data).toHaveLength(1);
    });
  });

  describe("Personal records (admin)", () => {
    it("manual add, verify, correct and history are persisted and audited", async () => {
      const m = await h.createMember("pr");
      const manual = await h.http().post("/admin/prs/manual").set(h.as(h.admin.token)).send({ userId: m.id, exerciseId: squatId, value: 100, achievedAt: new Date().toISOString(), reason: "Witnessed in class" });
      expect(manual.status).toBe(201);
      const prId = manual.body.id;
      expect(await audit("pr.manual_add", prId)).not.toBeNull();

      expect((await h.http().patch(`/admin/prs/${prId}/verify`).set(h.as(h.admin.token))).status).toBe(200);
      expect((await h.prisma.client.personalRecord.findUniqueOrThrow({ where: { id: prId } })).verificationStatus).toBe("VERIFIED");
      expect(await audit("pr.verify", prId)).not.toBeNull();

      const corrected = await h.http().patch(`/admin/prs/${prId}/correct`).set(h.as(h.admin.token)).send({ value: 95, achievedAt: new Date().toISOString(), reason: "Typo" });
      expect(corrected.status).toBe(200);
      expect(Number((await h.prisma.client.personalRecord.findUniqueOrThrow({ where: { id: prId } })).value)).toBe(95);
      expect(await audit("pr.correct", prId)).not.toBeNull();

      const history = await h.http().get(`/admin/prs/${prId}/history`).set(h.as(h.admin.token));
      expect(history.body.length).toBeGreaterThanOrEqual(2);

      expect((await h.http().post("/admin/prs/manual").set(h.as(h.admin.token)).send({ userId: m.id, exerciseId: squatId, value: -5, achievedAt: new Date().toISOString(), reason: "bad" })).status).toBe(400);
      const list = await h.http().get(`/admin/prs?userId=${m.id}`).set(h.as(h.admin.token));
      expect(list.body.data).toHaveLength(1);
    });
  });

  describe("Analytics, notifications and settings", () => {
    it("overview returns live counts that move when data changes", async () => {
      const before = (await h.http().get("/admin/analytics/overview").set(h.as(h.admin.token))).body;
      await h.createMember("analytics");
      const after = (await h.http().get("/admin/analytics/overview").set(h.as(h.admin.token))).body;
      expect(after.members.total).toBe(before.members.total + 1);
      expect(after.members.newLast30Days).toBe(before.members.newLast30Days + 1);
      expect(after.memberships.active).toBe(before.memberships.active + 1);
    });

    it("admin notification log lists notifications the system sent", async () => {
      const res = await h.http().get("/admin/notifications").set(h.as(h.admin.token));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("gym settings persist, and trainers can read but not change them", async () => {
      const before = (await h.http().get("/admin/settings/gym").set(h.as(h.admin.token))).body;
      const upd = await h.http().patch("/admin/settings/gym").set(h.as(h.admin.token)).send({ address: `${h.tag} address` });
      expect(upd.status).toBe(200);
      expect((await h.http().get("/admin/settings/gym").set(h.as(trainer.token))).body.address).toBe(`${h.tag} address`);
      expect((await h.http().patch("/admin/settings/gym").set(h.as(trainer.token)).send({ address: "x" })).status).toBe(403);
      await h.http().patch("/admin/settings/gym").set(h.as(h.admin.token)).send({ address: before.address ?? "" });
      expect((await h.http().get("/admin/settings/system").set(h.as(h.admin.token))).status).toBe(200);
    });
  });
});
