import { createHarness } from "./support/harness";
import { gymDateString } from "../src/common/gym-time";

/**
 * The member experience, end to end, including the two concurrency guarantees
 * the design relies on: the last class spot can never be double-booked, and
 * simultaneous PR submissions leave one consistent record with a coherent history.
 */
describe("Member flow (e2e)", () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  let trainer: Awaited<ReturnType<typeof h.createTrainer>>;
  let member: Awaited<ReturnType<typeof h.createMember>>;
  let squatId: string;
  let rowId: string;

  const workout = (token: string, body: Record<string, unknown>) => h.http().post("/workouts").set(h.as(token)).send(body);

  beforeAll(async () => {
    h = await createHarness("e2e-mem");
    trainer = await h.createTrainer("trainer");
    member = await h.createMember("member");
    squatId = (await h.prisma.client.exercise.findFirstOrThrow({ where: { name: "Back Squat" } })).id;
    rowId = (await h.prisma.client.exercise.findFirstOrThrow({ where: { name: "Row (500m)" } })).id;
  });
  afterAll(async () => h.cleanup());

  describe("Home data", () => {
    it("sees their own active membership", async () => {
      const res = await h.http().get("/memberships/me").set(h.as(member.token));
      expect(res.status).toBe(200);
      expect(res.body.computedStatus).toBe("ACTIVE");
    });

    it("gets today's published WOD (gym calendar day) but never a draft", async () => {
      const today = gymDateString(new Date(), process.env.GYM_TIMEZONE ?? "Europe/Belgrade");
      const squat = squatId;
      const make = (title: string) =>
        h.http().post("/wods").set(h.as(h.admin.token)).send({
          title,
          date: today,
          type: "AMRAP",
          sections: [{ type: "STRENGTH", order: 1, exercises: [{ exerciseId: squat, order: 1, sets: 3, reps: 5 }] }],
        });
      const wod = await make(`${h.tag} today`);
      expect(wod.status).toBe(201);

      const hidden = await h.http().get("/wods/today").set(h.as(member.token));
      expect(hidden.body?.title === `${h.tag} today`).toBe(false);

      await h.http().patch(`/wods/${wod.body.id}/publish`).set(h.as(h.admin.token));
      const shown = await h.http().get("/wods/today").set(h.as(member.token));
      expect(shown.status).toBe(200);
      expect(shown.body.title).toBe(`${h.tag} today`);

      // Staff move it out of the way so other suites/dev data are not affected.
      await h.http().patch(`/wods/${wod.body.id}/archive`).set(h.as(h.admin.token));
    });

    it("sees published announcements and the active challenge list", async () => {
      expect((await h.http().get("/announcements").set(h.as(member.token))).status).toBe(200);
      expect((await h.http().get("/challenges").set(h.as(member.token))).status).toBe(200);
    });
  });

  describe("Booking", () => {
    it("books, rejects a duplicate, cancels, and can rebook", async () => {
      const cls = await h.createClass(trainer.coachId, 5);
      const first = await h.http().post("/bookings").set(h.as(member.token)).send({ classId: cls.id });
      expect(first.status).toBe(201);
      expect(first.body.status).toBe("BOOKED");
      expect((await h.http().post("/bookings").set(h.as(member.token)).send({ classId: cls.id })).status).toBe(409);
      expect((await h.prisma.client.class.findUniqueOrThrow({ where: { id: cls.id } })).bookedCount).toBe(1);

      const upcoming = await h.http().get("/bookings/me?upcoming=true").set(h.as(member.token));
      expect(upcoming.body.data.some((b: { id: string }) => b.id === first.body.id)).toBe(true);

      expect((await h.http().patch(`/bookings/${first.body.id}/cancel`).set(h.as(member.token))).status).toBe(200);
      expect((await h.prisma.client.class.findUniqueOrThrow({ where: { id: cls.id } })).bookedCount).toBe(0);
      const gone = await h.http().get("/bookings/me?upcoming=true").set(h.as(member.token));
      expect(gone.body.data.some((b: { id: string }) => b.id === first.body.id)).toBe(false);

      const again = await h.http().post("/bookings").set(h.as(member.token)).send({ classId: cls.id });
      expect(again.status).toBe(201);
      expect(again.body.status).toBe("BOOKED");
    });

    it("cannot cancel someone else's booking", async () => {
      const other = await h.createMember("other");
      const cls = await h.createClass(trainer.coachId, 5);
      const booking = await h.http().post("/bookings").set(h.as(other.token)).send({ classId: cls.id });
      expect((await h.http().patch(`/bookings/${booking.body.id}/cancel`).set(h.as(member.token))).status).toBe(403);
    });

    it("cannot book a class that already ended", async () => {
      const past = await h.createClass(trainer.coachId, 5, -5);
      expect((await h.http().post("/bookings").set(h.as(member.token)).send({ classId: past.id })).status).toBe(400);
    });

    it("an expired membership cannot book", async () => {
      const m = await h.createMember("expired", { membership: false });
      const plan = await h.prisma.client.membershipPlan.findFirstOrThrow({ where: { name: { startsWith: h.tag } } });
      await h.http().post("/admin/memberships").set(h.as(h.admin.token)).send({
        userId: m.id,
        planId: plan.id,
        startDate: new Date(Date.now() - 60 * 86_400_000).toISOString(),
        endDate: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      });
      const cls = await h.createClass(trainer.coachId, 5);
      expect((await h.http().post("/bookings").set(h.as(m.token)).send({ classId: cls.id })).status).toBe(403);
    });

    it("waitlist: a full class waitlists, and a cancellation promotes the member and notifies them", async () => {
      const a = await h.createMember("wl-a");
      const b = await h.createMember("wl-b");
      const cls = await h.createClass(trainer.coachId, 1);
      const first = await h.http().post("/bookings").set(h.as(a.token)).send({ classId: cls.id });
      const second = await h.http().post("/bookings").set(h.as(b.token)).send({ classId: cls.id });
      expect(second.body.status).toBe("WAITLISTED");

      await h.http().patch(`/bookings/${first.body.id}/cancel`).set(h.as(a.token));
      const promoted = await h.prisma.client.booking.findUniqueOrThrow({ where: { id: second.body.id } });
      expect(promoted.status).toBe("BOOKED");
      const notes = await h.http().get("/notifications/me").set(h.as(b.token));
      expect(notes.body.data.some((n: { title: string }) => n.title.includes("off the waitlist"))).toBe(true);
    });

    it("CONCURRENCY: 8 members racing for 3 spots -> exactly 3 booked, 5 waitlisted, count never exceeds capacity", async () => {
      const racers = await Promise.all(Array.from({ length: 8 }, (_, i) => h.createMember(`race-${i}`)));
      const cls = await h.createClass(trainer.coachId, 3);

      const results = await Promise.all(racers.map((r) => h.http().post("/bookings").set(h.as(r.token)).send({ classId: cls.id })));
      expect(results.every((r) => r.status === 201)).toBe(true);
      const booked = results.filter((r) => r.body.status === "BOOKED").length;
      const waitlisted = results.filter((r) => r.body.status === "WAITLISTED").length;
      expect(booked).toBe(3);
      expect(waitlisted).toBe(5);

      const row = await h.prisma.client.class.findUniqueOrThrow({ where: { id: cls.id } });
      expect(row.bookedCount).toBe(3);
      expect(await h.prisma.client.booking.count({ where: { classId: cls.id, status: "BOOKED" } })).toBe(3);
    }, 60_000);

    it("CONCURRENCY: the same member double-submitting books once", async () => {
      const m = await h.createMember("double");
      const cls = await h.createClass(trainer.coachId, 5);
      const [x, y, z] = await Promise.all([1, 2, 3].map(() => h.http().post("/bookings").set(h.as(m.token)).send({ classId: cls.id })));
      expect([x.status, y.status, z.status].sort()).toEqual([201, 409, 409]);
      expect(await h.prisma.client.booking.count({ where: { classId: cls.id, userId: m.id } })).toBe(1);
      expect((await h.prisma.client.class.findUniqueOrThrow({ where: { id: cls.id } })).bookedCount).toBe(1);
    }, 30_000);
  });

  describe("Workouts and PRs", () => {
    let m: Awaited<ReturnType<typeof h.createMember>>;
    beforeAll(async () => {
      m = await h.createMember("lifter");
    });

    it("first result creates a PR; lower is not a PR; higher is, with history and a notification", async () => {
      const first = await workout(m.token, { exerciseId: squatId, weightKg: 80, reps: 5 });
      expect(first.status).toBe(201);
      expect(first.body.prOutcome.isNewPr).toBe(true);

      const lower = await workout(m.token, { exerciseId: squatId, weightKg: 70, reps: 5 });
      expect(lower.body.prOutcome.isNewPr).toBe(false);

      const higher = await workout(m.token, { exerciseId: squatId, weightKg: 90, reps: 3 });
      expect(higher.body.prOutcome.isNewPr).toBe(true);
      expect(Number(higher.body.prOutcome.previousValue)).toBe(80);

      const prs = await h.http().get("/prs/me").set(h.as(m.token));
      const squat = prs.body.find((p: { exerciseId: string }) => p.exerciseId === squatId);
      expect(Number(squat.value)).toBe(90);

      const history = await h.http().get(`/prs/me/${squatId}/history`).set(h.as(m.token));
      expect(history.body.map((x: { newValue: string }) => Number(x.newValue)).sort()).toEqual([80, 90]);

      const notes = await h.http().get("/notifications/me").set(h.as(m.token));
      expect(notes.body.data.filter((n: { type: string }) => n.type === "NEW_PR")).toHaveLength(2);
    });

    it("time-based exercises treat a LOWER time as the PR", async () => {
      expect((await workout(m.token, { exerciseId: rowId, durationSeconds: 130 })).body.prOutcome.isNewPr).toBe(true);
      expect((await workout(m.token, { exerciseId: rowId, durationSeconds: 140 })).body.prOutcome.isNewPr).toBe(false);
      expect((await workout(m.token, { exerciseId: rowId, durationSeconds: 122 })).body.prOutcome.isNewPr).toBe(true);
    });

    it("validates workout input", async () => {
      expect((await workout(m.token, {})).status).toBe(400);
      expect((await workout(m.token, { exerciseId: squatId, weightKg: -5 })).status).toBe(400);
      expect((await workout(m.token, { exerciseId: "00000000-0000-4000-8000-000000000000", weightKg: 5 })).status).toBe(404);
    });

    it("cannot log against a deactivated exercise", async () => {
      const ex = await h.http().post("/exercises").set(h.as(h.admin.token)).send({ name: `${h.tag} Retired`, category: "OTHER", measurementType: "REPS", prType: "MAX_REPS" });
      await h.http().patch(`/exercises/${ex.body.id}/deactivate`).set(h.as(h.admin.token));
      expect((await workout(m.token, { exerciseId: ex.body.id, reps: 10 })).status).toBe(400);
    });

    it("keeps each member's PRs and history private to them", async () => {
      const spy = await h.createMember("spy");
      const prs = await h.http().get("/prs/me").set(h.as(spy.token));
      expect(prs.body).toEqual([]);
      expect((await h.http().get("/admin/prs").set(h.as(spy.token))).status).toBe(403);
    });

    it("workout history lists their results newest first", async () => {
      const res = await h.http().get("/workouts/me").set(h.as(m.token));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(6);
      const times = res.body.data.map((w: { completedAt: string }) => new Date(w.completedAt).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it("CONCURRENCY: 6 simultaneous submissions leave one PR (the max) and a strictly increasing history chain", async () => {
      const racer = await h.createMember("pr-race");
      const weights = [100, 105, 110, 115, 120, 125];
      const results = await Promise.all(weights.map((w) => workout(racer.token, { exerciseId: squatId, weightKg: w, reps: 1 })));
      expect(results.every((r) => r.status === 201)).toBe(true);

      const rows = await h.prisma.client.personalRecord.findMany({ where: { userId: racer.id, exerciseId: squatId } });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].value)).toBe(125);

      const history = await h.prisma.client.personalRecordHistory.findMany({ where: { userId: racer.id, exerciseId: squatId }, orderBy: { createdAt: "asc" } });
      const chain = history.map((x) => Number(x.newValue));
      expect(chain).toEqual([...chain].sort((a, b) => a - b));
      expect(new Set(chain).size).toBe(chain.length);
      history.forEach((entry, i) => {
        expect(entry.previousValue === null ? null : Number(entry.previousValue)).toBe(i === 0 ? null : Number(history[i - 1].newValue));
      });
      expect(Number(history[history.length - 1].newValue)).toBe(125);
      // every submitted workout was stored regardless of who won
      expect(await h.prisma.client.workoutResult.count({ where: { userId: racer.id } })).toBe(6);
    }, 60_000);
  });

  describe("Progress", () => {
    it("reports real totals, a streak and weekly training days from stored activity", async () => {
      const m = await h.createMember("progress");
      const empty = await h.http().get("/progress/me").set(h.as(m.token));
      expect(empty.status).toBe(200);
      expect(empty.body).toMatchObject({ workoutsCompleted: 0, classesAttended: 0, prCount: 0, currentStreakDays: 0 });

      await workout(m.token, { exerciseId: squatId, weightKg: 60, reps: 5 });
      await workout(m.token, { exerciseId: rowId, durationSeconds: 125 });

      const res = await h.http().get("/progress/me").set(h.as(m.token));
      expect(res.body.workoutsCompleted).toBe(2);
      expect(res.body.prCount).toBe(2);
      expect(res.body.currentStreakDays).toBe(1);
      expect(res.body.trainingDaysLast30).toBe(1);
      expect(res.body.weeklyTrainingDays[0].trainingDays).toBe(1);
      expect(res.body.recentPrs).toHaveLength(2);
    });

    it("requires authentication", async () => {
      expect((await h.http().get("/progress/me")).status).toBe(401);
    });
  });

  describe("Notifications", () => {
    it("lists, marks one read, marks all read, and only touches their own", async () => {
      const m = await h.createMember("notif");
      const cls = await h.createClass(trainer.coachId, 5);
      await h.http().post("/bookings").set(h.as(m.token)).send({ classId: cls.id });
      await workout(m.token, { exerciseId: squatId, weightKg: 50, reps: 5 });

      const list = await h.http().get("/notifications/me").set(h.as(m.token));
      expect(list.body.data.length).toBeGreaterThanOrEqual(2);
      const first = list.body.data[0];

      const stranger = await h.createMember("stranger");
      expect((await h.http().patch(`/notifications/me/${first.id}/read`).set(h.as(stranger.token))).status).toBeGreaterThanOrEqual(400);
      expect((await h.prisma.client.notification.findUniqueOrThrow({ where: { id: first.id } })).readAt).toBeNull();

      expect((await h.http().patch(`/notifications/me/${first.id}/read`).set(h.as(m.token))).status).toBe(200);
      expect((await h.http().patch("/notifications/me/read-all").set(h.as(m.token))).status).toBe(200);
      expect(await h.prisma.client.notification.count({ where: { userId: m.id, readAt: null } })).toBe(0);
    });
  });

  describe("Account access", () => {
    it("a suspended member is locked out immediately", async () => {
      const m = await h.createMember("suspend");
      await h.http().patch(`/admin/members/${m.id}/status`).set(h.as(h.admin.token)).send({ status: "SUSPENDED" });
      expect((await h.http().get("/memberships/me").set(h.as(m.token))).status).toBe(401);
    });

    it("can change their own password and use the new one", async () => {
      const m = await h.createMember("changepw");
      const res = await h.http().post("/auth/change-password").set(h.as(m.token)).send({ currentPassword: m.password, newPassword: "BrandNewPassw0rd!" });
      expect(res.status).toBe(200);
      expect((await h.login(m.email, m.password)).status).toBe(401);
      expect((await h.login(m.email, "BrandNewPassw0rd!")).status).toBe(200);
    });
  });
});
