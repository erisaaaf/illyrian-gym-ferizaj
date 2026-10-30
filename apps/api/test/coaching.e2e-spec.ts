import { createHarness } from "./support/harness";

/**
 * Coaching and privacy end to end:
 *  - a trainer reaches ONLY their assigned clients; the owner reaches all; reception and members none
 *  - a plan assigned by a trainer shows up in the member's account (same records), with adherence
 *  - progress reports use real data; body measurements appear only when the member shared them
 *  - body photos are private: only the owner, or the assigned trainer for photos the member shared - never the admin
 *  - messages and schedule-change notices reach members and report real delivery / read evidence
 */
describe("Coaching, privacy and communication (e2e)", () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  let alice: Awaited<ReturnType<typeof h.createTrainer>>;
  let bob: Awaited<ReturnType<typeof h.createTrainer>>;
  let desk: Awaited<ReturnType<typeof h.createReceptionist>>;
  let squatId: string;
  let rowId: string;

  const get = (token: string, path: string) => h.http().get(path).set(h.as(token));
  const assign = (memberId: string, coachId: string | null) => h.http().patch(`/admin/members/${memberId}`).set(h.as(h.admin.token)).send({ assignedCoachId: coachId });
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]).toString("base64");
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]).toString("base64");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const binary = (res: any, cb: any) => {
    const chunks: Buffer[] = [];
    res.on("data", (c: Buffer) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  };

  beforeAll(async () => {
    h = await createHarness("e2e-coach");
    alice = await h.createTrainer("alice");
    bob = await h.createTrainer("bob");
    desk = await h.createReceptionist("desk");
    squatId = (await h.prisma.client.exercise.findFirstOrThrow({ where: { name: "Back Squat" } })).id;
    rowId = (await h.prisma.client.exercise.findFirstOrThrow({ where: { name: "Row (500m)" } })).id;
  });
  afterAll(async () => h.cleanup());

  describe("Assigned clients (trainer portal scoping)", () => {
    it("a trainer lists only their own clients; the owner can see any trainer's; others get nothing", async () => {
      const mine = await h.createMember("mine");
      const theirs = await h.createMember("theirs");
      const nobody = await h.createMember("nobody");
      await assign(mine.id, alice.coachId!);
      await assign(theirs.id, bob.coachId!);

      const aliceList = (await get(alice.token, "/clients?pageSize=100")).body.data.map((c: { id: string }) => c.id);
      expect(aliceList).toContain(mine.id);
      expect(aliceList).not.toContain(theirs.id);
      expect(aliceList).not.toContain(nobody.id);

      const ownerForBob = (await get(h.admin.token, `/clients?coachId=${bob.coachId}&pageSize=100`)).body.data.map((c: { id: string }) => c.id);
      expect(ownerForBob).toContain(theirs.id);
      expect(ownerForBob).not.toContain(mine.id);

      expect((await get(desk.token, "/clients")).status).toBe(403);
      expect((await get(mine.token, "/clients")).status).toBe(403);
    });

    it("a trainer cannot open, report on, annotate or plan for someone else's client (404, not 403)", async () => {
      const theirs = await h.createMember("other-client");
      await assign(theirs.id, bob.coachId!);
      expect((await get(alice.token, `/clients/${theirs.id}`)).status).toBe(404);
      expect((await get(alice.token, `/clients/${theirs.id}/report`)).status).toBe(404);
      expect((await h.http().post(`/clients/${theirs.id}/notes`).set(h.as(alice.token)).send({ body: "hi" })).status).toBe(404);
      expect((await h.http().post("/workout-plans").set(h.as(alice.token)).send({ userId: theirs.id, title: "x", startsOn: "2026-10-01", items: [] })).status).toBe(404);
      expect((await get(alice.token, `/workout-plans?userId=${theirs.id}`)).body.data).toHaveLength(0);
      expect((await get(alice.token, `/clients/${theirs.id}/body`)).status).toBe(404);
      // while the owner may look (operational view)
      expect((await get(h.admin.token, `/clients/${theirs.id}`)).status).toBe(200);
    });

    it("the client view carries coaching data only - never payments, invoices, balances or contact details", async () => {
      const client = await h.createMember("coaching-only");
      await assign(client.id, alice.coachId!);
      const detail = (await get(alice.token, `/clients/${client.id}`)).body;
      const text = JSON.stringify(detail);
      for (const secret of ["invoices", "payments", "balanceCents", "totalPaid", "adminNotes", client.email, "phone", "passwordHash"]) expect(text).not.toContain(secret);
      expect(detail.membership.status).toBeDefined();
      expect(detail.progress).toBeDefined();

      const list = JSON.stringify((await get(alice.token, "/clients?pageSize=100")).body);
      expect(list).not.toContain("email");
      expect(list).not.toContain("balance");
    });

    it("reassigning a client moves them between trainers immediately", async () => {
      const m = await h.createMember("moves");
      await assign(m.id, alice.coachId!);
      expect((await get(alice.token, `/clients/${m.id}`)).status).toBe(200);
      await assign(m.id, bob.coachId!);
      expect((await get(alice.token, `/clients/${m.id}`)).status).toBe(404);
      expect((await get(bob.token, `/clients/${m.id}`)).status).toBe(200);
      await assign(m.id, null);
      expect((await get(bob.token, `/clients/${m.id}`)).status).toBe(404);
    });
  });

  describe("Workout plans (shared records)", () => {
    it("a plan the trainer assigns appears in the member's account, with today's session and a notification", async () => {
      const client = await h.createMember("planned");
      await assign(client.id, alice.coachId!);
      const items = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, exerciseId: squatId, sets: 5, reps: 5, weightKg: 60 + weekday }));
      const created = await h.http().post("/workout-plans").set(h.as(alice.token)).send({ userId: client.id, title: "Strength block", goal: "Add 10 kg", startsOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), items });
      expect(created.status).toBe(201);
      expect(created.body.createdById).toBe(alice.id);
      expect(created.body.items).toHaveLength(7);

      const mine = (await get(client.token, "/me/workout-plans")).body;
      expect(mine.plans).toHaveLength(1);
      expect(mine.plans[0].title).toBe("Strength block");
      expect(mine.plans[0].isCurrent).toBe(true);
      expect(mine.plans[0].todayItems).toHaveLength(1);
      expect(mine.plans[0].todayItems[0].exercise.name).toBe("Back Squat");
      expect(mine.weekday).toBeGreaterThanOrEqual(1);

      const notes = (await get(client.token, "/notifications/me")).body.data;
      expect(notes.some((n: { title: string }) => n.title === "New workout plan")).toBe(true);
    });

    it("measures adherence from logged workouts on planned days", async () => {
      const client = await h.createMember("adherent");
      await assign(client.id, alice.coachId!);
      const created = await h.http().post("/workout-plans").set(h.as(alice.token)).send({
        userId: client.id,
        title: "Daily",
        startsOn: new Date().toISOString().slice(0, 10),
        items: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, exerciseId: squatId })),
      });
      let plan = (await get(alice.token, `/workout-plans/${created.body.id}`)).body;
      expect(plan.adherence).toMatchObject({ plannedDays: 1, completedDays: 0, percent: 0 }); // today is planned, nothing logged

      await h.http().post("/workouts").set(h.as(client.token)).send({ exerciseId: squatId, weightKg: 60, reps: 5 });
      plan = (await get(alice.token, `/workout-plans/${created.body.id}`)).body;
      expect(plan.adherence).toMatchObject({ plannedDays: 1, completedDays: 1, percent: 100 });
      expect((await get(client.token, "/me/workout-plans")).body.plans[0].adherence.percent).toBe(100);
    });

    it("validates plans and keeps archived ones out of the member's current view", async () => {
      const client = await h.createMember("plan-valid");
      await assign(client.id, alice.coachId!);
      const post = (body: Record<string, unknown>) => h.http().post("/workout-plans").set(h.as(alice.token)).send({ userId: client.id, title: "P", startsOn: "2026-10-01", items: [], ...body });
      expect((await post({ items: [{ weekday: 8, exerciseId: squatId }] })).status).toBe(400);
      expect((await post({ items: [{ weekday: 1, exerciseId: "00000000-0000-4000-8000-000000000000" }] })).status).toBe(400);
      expect((await post({ endsOn: "2026-09-01" })).status).toBe(400);
      expect((await post({ title: "" })).status).toBe(400);

      const ok = await post({ items: [{ weekday: 1, exerciseId: squatId, reps: 5 }] });
      expect(ok.status).toBe(201);
      const edited = await h.http().patch(`/workout-plans/${ok.body.id}`).set(h.as(alice.token)).send({ title: "Renamed", items: [{ weekday: 2, exerciseId: rowId, durationSeconds: 120 }] });
      expect(edited.body.title).toBe("Renamed");
      expect(edited.body.items).toHaveLength(1);
      expect(edited.body.items[0].weekday).toBe(2);

      await h.http().patch(`/workout-plans/${ok.body.id}`).set(h.as(alice.token)).send({ status: "ARCHIVED" });
      expect((await get(client.token, "/me/workout-plans")).body.plans).toHaveLength(0);
      expect((await get(client.token, "/workout-plans")).status).toBe(403); // members use /me/workout-plans
    });
  });

  describe("Trainer notes and the progress report", () => {
    it("notes are staff-only, attributed, and only the author (or the owner) can delete them", async () => {
      const client = await h.createMember("noted");
      await assign(client.id, alice.coachId!);
      const note = await h.http().post(`/clients/${client.id}/notes`).set(h.as(alice.token)).send({ body: "Work on the catch position" });
      expect(note.status).toBe(201);
      const detail = (await get(alice.token, `/clients/${client.id}`)).body;
      expect(detail.notes[0].body).toBe("Work on the catch position");
      expect(detail.notes[0].author.id).toBe(alice.id);
      expect(JSON.stringify((await get(client.token, "/users/me")).body)).not.toContain("catch position");
      expect((await h.http().post(`/clients/${client.id}/notes`).set(h.as(alice.token)).send({ body: "" })).status).toBe(400);

      await assign(client.id, bob.coachId!); // bob takes over
      expect((await h.http().delete(`/trainer-notes/${note.body.id}`).set(h.as(bob.token))).status).toBe(403); // bob can see it but did not write it
      expect((await h.http().delete(`/trainer-notes/${note.body.id}`).set(h.as(alice.token))).status).toBe(404); // alice no longer has this client
      expect((await h.http().delete(`/trainer-notes/${note.body.id}`).set(h.as(h.admin.token))).status).toBe(200);
    });

    it("builds the report from real records: frequency, strength progress, PRs, attendance and notes", async () => {
      const client = await h.createMember("reported");
      await assign(client.id, alice.coachId!);
      const log = (weightKg: number) => h.http().post("/workouts").set(h.as(client.token)).send({ exerciseId: squatId, weightKg, reps: 3 });
      await log(80);
      await log(90);
      await log(100);
      await h.http().post(`/clients/${client.id}/notes`).set(h.as(alice.token)).send({ body: "Great week" });

      const report = (await get(alice.token, `/clients/${client.id}/report`)).body;
      expect(report.client.id).toBe(client.id);
      expect(report.workoutFrequency).toMatchObject({ trainingDays: 1, workoutsLogged: 3 });
      expect(report.strengthProgress).toHaveLength(1);
      expect(report.strengthProgress[0]).toMatchObject({ exercise: "Back Squat", startValue: 80, currentValue: 100, changePercent: 25, newRecords: 3 });
      expect(report.totalPersonalRecords).toBe(1);
      expect(report.trainerNotes[0].body).toBe("Great week");
      expect(report.attendance).toEqual({ gymVisits: 0, classesAttended: 0 });
      // the owner gets the same operational report
      expect((await get(h.admin.token, `/clients/${client.id}/report`)).status).toBe(200);
    });
  });

  describe("Body measurements: private by default", () => {
    it("are visible to nobody but the member until shared; sharing and unsharing take effect immediately", async () => {
      const client = await h.createMember("body-a");
      await assign(client.id, alice.coachId!);
      const add = await h.http().post("/body/measurements").set(h.as(client.token)).send({ weightKg: 82.5, waistCm: 90, notes: "Morning", measuredAt: new Date(Date.now() - 3_600_000).toISOString() });
      expect(add.status).toBe(201);
      expect(add.body.sharedWithCoach).toBe(false); // private by default

      expect((await get(alice.token, `/clients/${client.id}/body`)).body.measurements).toHaveLength(0);
      let report = (await get(alice.token, `/clients/${client.id}/report`)).body;
      expect(report.bodyMeasurements.sharedByMember).toBe(false);
      expect(report.bodyMeasurements.note).toMatch(/not shared/i);

      await h.http().patch(`/body/measurements/${add.body.id}/share`).set(h.as(client.token)).send({ sharedWithCoach: true });
      expect((await get(alice.token, `/clients/${client.id}/body`)).body.measurements).toHaveLength(1);
      await h.http().post("/body/measurements").set(h.as(client.token)).send({ weightKg: 80, waistCm: 88, sharedWithCoach: true });
      report = (await get(alice.token, `/clients/${client.id}/report`)).body;
      expect(report.bodyMeasurements.sharedByMember).toBe(true);
      const weight = report.bodyMeasurements.changes.find((c: { field: string }) => c.field === "weightKg");
      expect(weight).toMatchObject({ first: 82.5, latest: 80, change: -2.5 });

      await h.http().patch(`/body/measurements/${add.body.id}/share`).set(h.as(client.token)).send({ sharedWithCoach: false });
      expect((await get(alice.token, `/clients/${client.id}/body`)).body.measurements).toHaveLength(1);
    });

    it("another trainer, the owner and reception never see them, and nobody else can write them", async () => {
      const client = await h.createMember("body-b");
      await assign(client.id, alice.coachId!);
      await h.http().post("/body/measurements").set(h.as(client.token)).send({ weightKg: 70, sharedWithCoach: true });

      expect((await get(bob.token, `/clients/${client.id}/body`)).status).toBe(404); // not bob's client
      expect((await get(h.admin.token, `/clients/${client.id}/body`)).status).toBe(403); // the owner has no access to body data
      expect((await get(desk.token, `/clients/${client.id}/body`)).status).toBe(403);
      expect((await get(alice.token, "/body/measurements")).status).toBe(403); // /body is the member's own space
      expect((await get(h.admin.token, "/body/photos")).status).toBe(403);
      expect((await h.http().post("/body/measurements").set(h.as(alice.token)).send({ weightKg: 70 })).status).toBe(403);
    });

    it("validates measurements and lets the member delete their own only", async () => {
      const a = await h.createMember("body-c");
      const b = await h.createMember("body-d");
      expect((await h.http().post("/body/measurements").set(h.as(a.token)).send({})).status).toBe(400); // nothing entered
      expect((await h.http().post("/body/measurements").set(h.as(a.token)).send({ weightKg: 5 })).status).toBe(400);
      expect((await h.http().post("/body/measurements").set(h.as(a.token)).send({ weightKg: 70, waistCm: 5 })).status).toBe(400);
      const row = await h.http().post("/body/measurements").set(h.as(a.token)).send({ weightKg: 70 });
      expect((await h.http().delete(`/body/measurements/${row.body.id}`).set(h.as(b.token))).status).toBe(404);
      expect((await h.http().patch(`/body/measurements/${row.body.id}/share`).set(h.as(b.token)).send({ sharedWithCoach: true })).status).toBe(404);
      expect((await h.http().delete(`/body/measurements/${row.body.id}`).set(h.as(a.token))).status).toBe(200);
    });
  });

  describe("Body photos: private by default", () => {
    it("only the owner can see a private photo; an admin, a trainer and another member cannot", async () => {
      const client = await h.createMember("photo-a");
      const stranger = await h.createMember("photo-b");
      await assign(client.id, alice.coachId!);
      const up = await h.http().post("/body/photos").set(h.as(client.token)).send({ mimeType: "image/jpeg", dataBase64: jpeg, note: "Week 1" });
      expect(up.status).toBe(201);
      expect(up.body.sharedWithCoach).toBe(false);
      expect(up.body.data).toBeUndefined(); // listings never carry the bytes

      const own = await h.http().get(`/body/photos/${up.body.id}/image`).set(h.as(client.token)).buffer(true).parse(binary);
      expect(own.status).toBe(200);
      expect(own.headers["content-type"]).toBe("image/jpeg");
      expect(own.headers["cache-control"]).toContain("no-store");
      expect(own.headers["x-content-type-options"]).toBe("nosniff");
      expect(Buffer.from(own.body).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);

      for (const token of [alice.token, bob.token, h.admin.token, desk.token, stranger.token]) {
        expect((await get(token, `/body/photos/${up.body.id}/image`)).status).toBe(404);
      }
      expect((await get(alice.token, `/clients/${client.id}/body`)).body.photos).toHaveLength(0);
    });

    it("sharing lets only the ASSIGNED trainer see it (and logs that they did); unsharing closes it again", async () => {
      const client = await h.createMember("photo-c");
      await assign(client.id, alice.coachId!);
      const up = await h.http().post("/body/photos").set(h.as(client.token)).send({ mimeType: "image/png", dataBase64: png, sharedWithCoach: true });

      expect((await get(alice.token, `/body/photos/${up.body.id}/image`)).status).toBe(200);
      expect((await get(alice.token, `/clients/${client.id}/body`)).body.photos).toHaveLength(1);
      expect((await get(bob.token, `/body/photos/${up.body.id}/image`)).status).toBe(404); // not their client
      expect((await get(h.admin.token, `/body/photos/${up.body.id}/image`)).status).toBe(404); // the owner never sees photos
      expect(await h.prisma.client.auditLog.count({ where: { action: "body.photo_viewed_by_coach", entityId: up.body.id, actorId: alice.id } })).toBe(1);

      await h.http().patch(`/body/photos/${up.body.id}/share`).set(h.as(client.token)).send({ sharedWithCoach: false });
      expect((await get(alice.token, `/body/photos/${up.body.id}/image`)).status).toBe(404);

      // and if the client is reassigned, the new trainer does not inherit shared photos by magic
      await h.http().patch(`/body/photos/${up.body.id}/share`).set(h.as(client.token)).send({ sharedWithCoach: true });
      await assign(client.id, bob.coachId!);
      expect((await get(alice.token, `/body/photos/${up.body.id}/image`)).status).toBe(404);
      expect((await get(bob.token, `/body/photos/${up.body.id}/image`)).status).toBe(200);
    });

    it("rejects files that are not images, wrong types, empty, oversized, and images that lie about their type", async () => {
      const client = await h.createMember("photo-d");
      const send = (body: Record<string, unknown>) => h.http().post("/body/photos").set(h.as(client.token)).send(body);
      expect((await send({ mimeType: "image/jpeg", dataBase64: Buffer.from("<script>alert(1)</script>").toString("base64") })).status).toBe(400);
      expect((await send({ mimeType: "image/png", dataBase64: jpeg })).status).toBe(400); // JPEG bytes labelled PNG
      expect((await send({ mimeType: "application/pdf", dataBase64: jpeg })).status).toBe(400);
      expect((await send({ mimeType: "image/jpeg", dataBase64: "" })).status).toBe(400);
      expect((await send({ mimeType: "image/jpeg", dataBase64: "not base64!!" })).status).toBe(400);
      const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3 * 1024 * 1024 + 10, 1)]).toString("base64");
      expect((await send({ mimeType: "image/jpeg", dataBase64: huge })).status).toBe(400);
      const absurd = Buffer.alloc(6 * 1024 * 1024, 1).toString("base64");
      expect((await send({ mimeType: "image/jpeg", dataBase64: absurd })).status).toBe(413); // refused by the parser, not a 500
      expect(await h.prisma.client.progressPhoto.count({ where: { userId: client.id } })).toBe(0);
    });

    it("the member can list and delete their photos, and cannot touch anyone else's", async () => {
      const a = await h.createMember("photo-e");
      const b = await h.createMember("photo-f");
      const up = await h.http().post("/body/photos").set(h.as(a.token)).send({ mimeType: "image/jpeg", dataBase64: jpeg });
      expect((await get(a.token, "/body/photos")).body).toHaveLength(1);
      expect((await get(b.token, "/body/photos")).body).toHaveLength(0);
      expect((await h.http().delete(`/body/photos/${up.body.id}`).set(h.as(b.token))).status).toBe(404);
      expect((await h.http().delete(`/body/photos/${up.body.id}`).set(h.as(a.token))).status).toBe(200);
      expect((await get(a.token, `/body/photos/${up.body.id}/image`)).status).toBe(404);
    });

    it("a photo is never part of any report", async () => {
      const client = await h.createMember("photo-g");
      await assign(client.id, alice.coachId!);
      await h.http().post("/body/photos").set(h.as(client.token)).send({ mimeType: "image/jpeg", dataBase64: jpeg, sharedWithCoach: true });
      for (const body of [(await get(alice.token, `/clients/${client.id}/report`)).body, (await get(alice.token, `/clients/${client.id}`)).body, (await get(h.admin.token, `/admin/members/${client.id}`)).body]) {
        expect(JSON.stringify(body)).not.toContain("dataBase64");
        expect(JSON.stringify(body)).not.toContain("progressPhoto");
      }
    });
  });

  describe("Communication center", () => {
    const send = (token: string, body: Record<string, unknown>) => h.http().post("/messages").set(h.as(token)).send({ subject: `${h.tag} subject`, body: "Hello", ...body });

    it("reception sends an individual message; it arrives in the member's app and read-state is real", async () => {
      const m = await h.createMember("msg-a");
      const sent = await send(desk.token, { audience: "INDIVIDUAL", userId: m.id });
      expect(sent.status).toBe(201);
      expect(sent.body).toMatchObject({ recipientCount: 1, delivered: 1, read: 0 });

      const inbox = (await get(m.token, "/notifications/me")).body.data;
      const note = inbox.find((n: { title: string }) => n.title === `${h.tag} subject`);
      expect(note).toBeDefined();
      expect(note.type).toBe("MESSAGE");

      let history = (await get(h.admin.token, "/messages?pageSize=50")).body.data.find((x: { id: string }) => x.id === sent.body.id);
      expect(history.read).toBe(0);
      expect(history.channel).toBe("in-app");
      await h.http().patch(`/notifications/me/${note.id}/read`).set(h.as(m.token));
      history = (await get(h.admin.token, "/messages?pageSize=50")).body.data.find((x: { id: string }) => x.id === sent.body.id);
      expect(history.read).toBe(1); // evidence, not an estimate

      const detail = (await get(h.admin.token, `/messages/${sent.body.id}`)).body;
      expect(detail.recipients[0].readAt).not.toBeNull();
    });

    it("previews the audience before sending, and groups resolve correctly", async () => {
      const expiring = await h.createMember("msg-exp", { membership: false });
      const plan = await h.createPricedPlan(2000);
      await h.http().post("/admin/memberships").set(h.as(desk.token)).send({ userId: expiring.id, planId: plan.id, startDate: new Date(Date.now() - 25 * 86_400_000).toISOString(), endDate: new Date(Date.now() + 3 * 86_400_000).toISOString() });

      const preview = await h.http().post("/messages/preview").set(h.as(desk.token)).send({ subject: "x", body: "y", audience: "EXPIRING_SOON" });
      expect(preview.status).toBe(200);
      expect(preview.body.recipientCount).toBeGreaterThanOrEqual(1);
      expect(preview.body.channels).toEqual({ inApp: true, email: false, sms: false, push: false }); // honest about what exists
      expect(await h.prisma.client.message.count({ where: { subject: "x" } })).toBe(0); // previewing sends nothing

      const unpaid = await h.http().post("/messages/preview").set(h.as(desk.token)).send({ subject: "x", body: "y", audience: "UNPAID" });
      expect(unpaid.body.recipientCount).toBeGreaterThanOrEqual(1); // the one we just sold has an unpaid invoice
      const reminder = await send(desk.token, { audience: "EXPIRING_SOON", type: "MEMBERSHIP_EXPIRING", subject: `${h.tag} renew soon` });
      expect(reminder.status).toBe(201);
      const note = (await get(expiring.token, "/notifications/me")).body.data.find((n: { title: string }) => n.title === `${h.tag} renew soon`);
      expect(note.type).toBe("MEMBERSHIP_EXPIRING");
    });

    it("trainers can reach only their own clients; reception cannot broadcast to everyone", async () => {
      const mine = await h.createMember("msg-mine");
      const theirs = await h.createMember("msg-theirs");
      await assign(mine.id, alice.coachId!);
      await assign(theirs.id, bob.coachId!);

      expect((await send(alice.token, { audience: "INDIVIDUAL", userId: mine.id })).status).toBe(201);
      expect((await send(alice.token, { audience: "INDIVIDUAL", userId: theirs.id })).status).toBe(404);
      expect((await send(alice.token, { audience: "ALL_ACTIVE" })).status).toBe(403);
      expect((await send(alice.token, { audience: "AT_RISK" })).status).toBe(403);
      expect((await send(alice.token, { audience: "ASSIGNED_CLIENTS", type: "OFFER" })).status).toBe(403); // trainers send plain messages

      const group = await send(alice.token, { audience: "ASSIGNED_CLIENTS", subject: `${h.tag} team` });
      expect(group.status).toBe(201);
      expect(group.body.recipientCount).toBeGreaterThanOrEqual(1);
      expect((await get(theirs.token, "/notifications/me")).body.data.some((n: { title: string }) => n.title === `${h.tag} team`)).toBe(false);

      expect((await send(desk.token, { audience: "ALL_ACTIVE" })).status).toBe(403);
      expect((await send(desk.token, { audience: "ASSIGNED_CLIENTS" })).status).toBe(403);
      expect((await send(mine.token, { audience: "INDIVIDUAL", userId: mine.id })).status).toBe(403);
      // trainers see only what they sent
      const aliceHistory = (await get(alice.token, "/messages?pageSize=100")).body.data;
      expect(aliceHistory.every((m: { sentById: string }) => m.sentById === alice.id)).toBe(true);
      const adminHistory = (await get(h.admin.token, "/messages?pageSize=100")).body.data;
      expect(adminHistory.length).toBeGreaterThan(aliceHistory.length);
    });

    it("validates messages and refuses to send to nobody", async () => {
      const m = await h.createMember("msg-val");
      expect((await send(h.admin.token, { audience: "INDIVIDUAL" })).status).toBe(400); // member required
      expect((await send(h.admin.token, { audience: "INDIVIDUAL", userId: m.id, subject: "" })).status).toBe(400);
      expect((await send(h.admin.token, { audience: "INDIVIDUAL", userId: m.id, body: "x".repeat(2001) })).status).toBe(400);
      expect((await send(h.admin.token, { audience: "NOBODY" })).status).toBe(400);
      expect((await send(h.admin.token, { audience: "ASSIGNED_CLIENTS" })).status).toBe(403);
      // a group that resolves to nobody sends nothing
      await h.prisma.client.user.update({ where: { id: m.id }, data: { status: "SUSPENDED" } });
      expect((await send(h.admin.token, { audience: "INDIVIDUAL", userId: m.id })).status).toBe(404); // suspended members are not messaged
    });
  });

  describe("Schedule-change notices", () => {
    it("members booked into a class hear about a cancellation or a new time", async () => {
      const a = await h.createMember("sched-a");
      const b = await h.createMember("sched-b");
      const other = await h.createMember("sched-other");
      const cls = await h.createClass(alice.coachId, 5, 24, `${h.tag} moving class`);
      await h.http().post("/bookings").set(h.as(a.token)).send({ classId: cls.id });
      await h.http().post("/bookings").set(h.as(b.token)).send({ classId: cls.id });

      const start = new Date(Date.now() + 48 * 3_600_000);
      const moved = await h.http().patch(`/classes/${cls.id}`).set(h.as(h.admin.token)).send({ startTime: start.toISOString(), endTime: new Date(start.getTime() + 3_600_000).toISOString() });
      expect(moved.status).toBe(200);
      const titleOf = async (m: { token: string }) => (await get(m.token, "/notifications/me")).body.data.filter((n: { type: string }) => n.type === "SCHEDULE_CHANGE").map((n: { title: string }) => n.title);
      expect(await titleOf(a)).toEqual(["Class time changed"]);
      expect(await titleOf(b)).toEqual(["Class time changed"]);
      expect(await titleOf(other)).toEqual([]);

      // changing only the title does not spam members
      await h.http().patch(`/classes/${cls.id}`).set(h.as(h.admin.token)).send({ description: "Bring a towel" });
      expect(await titleOf(a)).toHaveLength(1);

      await h.http().patch(`/classes/${cls.id}/cancel`).set(h.as(h.admin.token));
      expect((await titleOf(a)).sort()).toEqual(["Class cancelled", "Class time changed"]);
      expect(await titleOf(other)).toEqual([]);
    });
  });
});
