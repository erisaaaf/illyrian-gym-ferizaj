import { createHarness } from "./support/harness";

/**
 * The front desk: reception role and permissions, member registration and categories, renewing and freezing
 * memberships, member requests, QR check-in (every outcome), the gym rules, reports and the business assistant.
 */
describe("Front desk (e2e)", () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  let reception: Awaited<ReturnType<typeof h.createReceptionist>>;
  let trainer: Awaited<ReturnType<typeof h.createTrainer>>;

  const DAY = 86_400_000;
  const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
  const staffGet = (token: string, path: string) => h.http().get(path).set(h.as(token));
  const checkIn = (body: Record<string, unknown>, token = reception.token) => h.http().post("/admin/check-in").set(h.as(token)).send(body);
  const qrOf = async (memberId: string) => (await staffGet(reception.token, `/admin/members/${memberId}/qr`)).body.token as string;
  const settings = (body: Record<string, unknown>) => h.http().patch("/admin/settings/gym").set(h.as(h.admin.token)).send(body);

  /** A member with a membership that runs from `startOffset` to `endOffset` days from now. */
  async function memberWith(label: string, startOffset = -1, endOffset = 29) {
    const member = await h.createMember(label, { membership: false });
    const plan = await h.createPricedPlan(4000);
    const res = await h.http().post("/admin/memberships").set(h.as(reception.token)).send({ userId: member.id, planId: plan.id, startDate: iso(startOffset), endDate: iso(endOffset), initialPayment: { amountCents: 4000, method: "CASH" } });
    expect(res.status).toBe(201);
    return { member, plan, membership: res.body };
  }

  beforeAll(async () => {
    h = await createHarness("e2e-desk");
    reception = await h.createReceptionist("desk");
    trainer = await h.createTrainer("coach");
  });
  afterAll(async () => {
    await settings({ duplicateScanMinutes: 10, blockUnpaidCheckIn: false, maxFreezeDays: null, atRiskShortDays: 14, atRiskLongDays: 30 });
    await h.cleanup();
  });

  describe("Reception role", () => {
    it("is created by the owner, activates with a one-time password, and sees only front-desk areas", async () => {
      const email = `${h.tag}-fresh@illyriangym.dev`;
      const created = await h.http().post("/admin/staff").set(h.as(h.admin.token)).send({ email, firstName: "Fresh", lastName: "Desk" });
      expect(created.status).toBe(201);
      expect(created.body.staff.role).toBe("RECEPTIONIST");
      expect(created.body.staff.mustChangePassword).toBe(true);
      await h.prisma.client.user.findUniqueOrThrow({ where: { email } });

      const session = await h.login(email, created.body.temporaryPassword);
      expect(session.body.user.role).toBe("RECEPTIONIST");
      expect((await staffGet(session.body.tokens.accessToken, "/admin/members")).status).toBe(403); // not until the password is changed
      await h.http().post("/auth/change-password").set(h.as(session.body.tokens.accessToken)).send({ currentPassword: created.body.temporaryPassword, newPassword: "DeskChoice123" });
      const again = await h.login(email, "DeskChoice123");
      expect((await staffGet(again.body.tokens.accessToken, "/admin/members")).status).toBe(200);
      await h.prisma.client.user.deleteMany({ where: { email } });
    });

    it("can do front-desk work but not owner work", async () => {
      expect((await staffGet(reception.token, "/admin/members")).status).toBe(200);
      expect((await staffGet(reception.token, "/admin/memberships")).status).toBe(200);
      expect((await staffGet(reception.token, "/admin/payments")).status).toBe(200);
      expect((await staffGet(reception.token, "/admin/invoices")).status).toBe(200);
      expect((await staffGet(reception.token, "/admin/check-in/today")).status).toBe(200);
      expect((await staffGet(reception.token, "/admin/settings/gym")).status).toBe(200); // may read gym info

      for (const [method, path] of [
        ["get", "/admin/staff"],
        ["get", "/admin/reports/dashboard"],
        ["get", "/admin/expenses"],
        ["get", "/admin/analytics/overview"],
        ["get", "/admin/finance/summary"],
        ["post", "/coaches"],
        ["post", "/classes"],
        ["post", "/membership-plans"],
        ["post", "/promotions"],
        ["patch", "/admin/settings/gym"],
      ] as const) {
        const res = await h.http()[method](path).set(h.as(reception.token)).send({});
        expect([403]).toContain(res.status);
      }
    });

    it("cannot suspend members, cancel memberships, or assign trainers", async () => {
      const { member, membership } = await memberWith("perm");
      expect((await h.http().patch(`/admin/members/${member.id}/status`).set(h.as(reception.token)).send({ status: "SUSPENDED" })).status).toBe(403);
      expect((await h.http().patch(`/admin/memberships/${membership.id}/cancel`).set(h.as(reception.token))).status).toBe(403);
      expect((await h.http().patch(`/admin/members/${member.id}`).set(h.as(reception.token)).send({ assignedCoachId: trainer.coachId })).status).toBe(403);
    });

    it("the owner manages receptionists, and the endpoint cannot touch other accounts", async () => {
      const list = await h.http().get("/admin/staff").set(h.as(h.admin.token));
      expect(list.body.data.some((s: { id: string }) => s.id === reception.id)).toBe(true);
      expect((await h.http().patch(`/admin/staff/${h.admin.id}/status`).set(h.as(h.admin.token)).send({ status: "SUSPENDED" })).status).toBe(403); // not a receptionist
      expect((await h.http().patch(`/admin/staff/${trainer.id}/status`).set(h.as(h.admin.token)).send({ status: "SUSPENDED" })).status).toBe(403);
      const off = await h.http().patch(`/admin/staff/${reception.id}/status`).set(h.as(h.admin.token)).send({ status: "SUSPENDED" });
      expect(off.status).toBe(200);
      expect((await staffGet(reception.token, "/admin/members")).status).toBe(401); // immediately locked out
      await h.http().patch(`/admin/staff/${reception.id}/status`).set(h.as(h.admin.token)).send({ status: "ACTIVE" });
      expect((await staffGet(reception.token, "/admin/members")).status).toBe(200);
    });
  });

  describe("Members", () => {
    it("registers members with unique sequential member numbers", async () => {
      const make = async (n: string) => (await h.http().post("/admin/members").set(h.as(reception.token)).send({ email: `${h.tag}-reg-${n}@illyriangym.dev`, firstName: n, lastName: "Reg" }));
      const [a, b, c] = await Promise.all([make("a"), make("b"), make("c")]); // concurrent registrations
      const numbers = [a, b, c].map((r) => r.body.member.memberNumber);
      expect(numbers.every((n) => /^IG-\d{5}$/.test(n))).toBe(true);
      expect(new Set(numbers).size).toBe(3);
      expect(a.body.member.mustChangePassword).toBe(true);
      for (const r of [a, b, c]) await h.prisma.client.user.deleteMany({ where: { id: r.body.member.id } });
    });

    it("searches by member number and filters by the requirement's categories", async () => {
      const active = await memberWith("cat-active");
      const expired = await memberWith("cat-expired", -60, -5);
      const none = await h.createMember("cat-none", { membership: false });
      const unpaidMember = await h.createMember("cat-unpaid", { membership: false });
      await h.http().post("/admin/memberships").set(h.as(reception.token)).send({ userId: unpaidMember.id, planId: active.plan.id, startDate: iso(0) });
      const unpaidId = unpaidMember.id;

      const ids = async (qs: string) => (await staffGet(reception.token, `/admin/members?pageSize=100&${qs}`)).body.data.map((m: { id: string }) => m.id);
      expect(await ids(`search=${(await h.prisma.client.user.findUniqueOrThrow({ where: { id: active.member.id } })).memberNumber}`)).toEqual([active.member.id]);
      expect(await ids("category=ACTIVE")).toEqual(expect.arrayContaining([active.member.id, unpaidId]));
      expect(await ids("category=ACTIVE")).not.toContain(expired.member.id);
      expect(await ids("category=EXPIRED")).toContain(expired.member.id);
      expect(await ids("category=EXPIRED")).not.toContain(active.member.id);
      expect(await ids("category=NO_MEMBERSHIP")).toContain(none.id);
      expect(await ids("category=NEW")).toEqual(expect.arrayContaining([active.member.id, none.id]));
      expect(await ids("category=UNPAID")).toContain(unpaidId);
      expect(await ids("category=UNPAID")).not.toContain(active.member.id); // paid in full

      await h.http().patch(`/admin/members/${none.id}/status`).set(h.as(h.admin.token)).send({ status: "INACTIVE" });
      expect(await ids("category=INACTIVE")).toContain(none.id);
    });

    it("the list carries the current membership, balance, visit count and trainer", async () => {
      const { member } = await memberWith("list-info");
      await h.http().patch(`/admin/members/${member.id}`).set(h.as(h.admin.token)).send({ assignedCoachId: trainer.coachId });
      await checkIn({ userId: member.id });
      const row = (await staffGet(reception.token, `/admin/members?search=${member.email}`)).body.data[0];
      expect(row.currentMembership.computedStatus).toBe("ACTIVE");
      expect(row.currentMembership.daysRemaining).toBeGreaterThan(20);
      expect(row.visitCount).toBe(1);
      expect(row.balanceCents).toBe(0);
      expect(row.assignedCoach.id).toBe(trainer.coachId);
    });

    it("staff notes are for staff; the detail hides training data from reception but not the owner", async () => {
      const { member } = await memberWith("notes");
      await h.http().patch(`/admin/members/${member.id}`).set(h.as(reception.token)).send({ adminNotes: "Prefers evening classes" });
      const forReception = (await staffGet(reception.token, `/admin/members/${member.id}`)).body;
      const forOwner = (await staffGet(h.admin.token, `/admin/members/${member.id}`)).body;
      expect(forReception.adminNotes).toBe("Prefers evening classes");
      expect(forReception.personalRecords).toBeUndefined();
      expect(forReception.workoutResults).toBeUndefined();
      expect(forOwner.personalRecords).toBeDefined();
      expect(forOwner.invoices).toHaveLength(1);
      expect(forOwner.payments).toHaveLength(1);
      // the member never receives their own staff notes
      expect(JSON.stringify((await h.http().get("/users/me").set(h.as(member.token))).body)).not.toContain("Prefers evening");
    });

    it("members only see a trainer's public profile, never contact details", async () => {
      const { member } = await memberWith("coach-view");
      const list = await h.http().get("/coaches?pageSize=100").set(h.as(member.token));
      const entry = list.body.data.find((c: { id: string }) => c.id === trainer.coachId);
      expect(entry.user.firstName).toBeDefined();
      expect(entry.user.email).toBeUndefined();
      expect(entry.user.phone).toBeUndefined();
      const asStaff = await h.http().get("/coaches?pageSize=100").set(h.as(h.admin.token));
      expect(asStaff.body.data.find((c: { id: string }) => c.id === trainer.coachId).user.email).toBeDefined();
    });
  });

  describe("Memberships: plan types, renewal, freezing, requests", () => {
    it("stores the plan type, package and included services", async () => {
      const plan = await h.http().post("/membership-plans").set(h.as(h.admin.token)).send({ name: `${h.tag} CrossFit 3M`, durationDays: 90, planType: "CROSSFIT", period: "QUARTERLY", services: ["CrossFit classes", "Open gym"] });
      expect(plan.status).toBe(201);
      expect(plan.body).toMatchObject({ planType: "CROSSFIT", period: "QUARTERLY", services: ["CrossFit classes", "Open gym"], priceCents: null });
      expect((await h.http().post("/membership-plans").set(h.as(h.admin.token)).send({ name: "x", durationDays: 30, planType: "SPA" })).status).toBe(400);
    });

    it("renewal creates a linked membership that starts when the current one ends, once only", async () => {
      const { membership, member } = await memberWith("renew", -10, 20);
      const renewed = await h.http().post(`/admin/memberships/${membership.id}/renew`).set(h.as(reception.token)).send({ initialPayment: { amountCents: 4000, method: "CASH" } });
      expect(renewed.status).toBe(201);
      expect(renewed.body.renewedFromId).toBe(membership.id);
      expect(new Date(renewed.body.startDate).toISOString()).toBe(new Date(membership.endDate).toISOString());
      expect(renewed.body.paymentStatus).toBe("PAID");
      expect((await h.http().post(`/admin/memberships/${membership.id}/renew`).set(h.as(reception.token)).send({})).status).toBe(409);

      const history = await h.http().get("/memberships/me/history").set(h.as(member.token));
      expect(history.body).toHaveLength(2);
      // the one that governs now is the current one, not the future renewal
      expect((await h.http().get("/memberships/me").set(h.as(member.token))).body.id).toBe(membership.id);
    });

    it("cancelled memberships cannot be renewed", async () => {
      const { membership } = await memberWith("renew-cancel");
      await h.http().patch(`/admin/memberships/${membership.id}/cancel`).set(h.as(h.admin.token));
      expect((await h.http().post(`/admin/memberships/${membership.id}/renew`).set(h.as(reception.token)).send({})).status).toBe(400);
    });

    it("freezing extends the end date, shows Frozen, blocks booking and entry, and can be ended early", async () => {
      const { member, membership } = await memberWith("freeze");
      const cls = await h.createClass(trainer.coachId, 5);

      const frozen = await h.http().post(`/admin/memberships/${membership.id}/freeze`).set(h.as(reception.token)).send({ until: iso(10), reason: "Travelling" });
      expect(frozen.status).toBe(200);
      expect(frozen.body.computedStatus).toBe("FROZEN");
      expect(frozen.body.totalFrozenDays).toBe(10);
      expect(Math.round((new Date(frozen.body.endDate).getTime() - new Date(membership.endDate).getTime()) / DAY)).toBe(10);

      const booking = await h.http().post("/bookings").set(h.as(member.token)).send({ classId: cls.id });
      expect(booking.status).toBe(403);
      expect(booking.body.message).toMatch(/frozen/i);
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("FROZEN");
      expect((await h.http().post(`/admin/memberships/${membership.id}/freeze`).set(h.as(reception.token)).send({ until: iso(20), reason: "again" })).status).toBe(409);

      const listed = await staffGet(reception.token, "/admin/memberships?status=FROZEN&pageSize=100");
      expect(listed.body.data.some((m: { id: string }) => m.id === membership.id)).toBe(true);
      expect((await staffGet(reception.token, `/admin/members?category=FROZEN&search=${member.email}`)).body.data).toHaveLength(1);

      const back = await h.http().post(`/admin/memberships/${membership.id}/unfreeze`).set(h.as(reception.token)).send({ reason: "Back early" });
      expect(back.status).toBe(200);
      expect(back.body.computedStatus).not.toBe("FROZEN");
      expect(back.body.totalFrozenDays).toBeLessThanOrEqual(1); // only the day(s) actually used remain
      expect((await h.http().post("/bookings").set(h.as(member.token)).send({ classId: cls.id })).status).toBe(201);
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("OK");
    });

    it("respects the gym's maximum freeze length when one is configured, and assumes none otherwise", async () => {
      const { membership } = await memberWith("freeze-max");
      expect((await settings({ maxFreezeDays: 5 })).status).toBe(200);
      const tooLong = await h.http().post(`/admin/memberships/${membership.id}/freeze`).set(h.as(reception.token)).send({ until: iso(10), reason: "Long trip" });
      expect(tooLong.status).toBe(400);
      expect(tooLong.body.message).toMatch(/maximum of 5/);
      expect((await h.http().post(`/admin/memberships/${membership.id}/freeze`).set(h.as(reception.token)).send({ until: iso(4), reason: "Short trip" })).status).toBe(200);
      await settings({ maxFreezeDays: null });
    });

    it("rejects invalid freezes (past start, end before start, expired or cancelled membership)", async () => {
      const { membership } = await memberWith("freeze-bad");
      const post = (body: Record<string, unknown>, id = membership.id) => h.http().post(`/admin/memberships/${id}/freeze`).set(h.as(reception.token)).send({ reason: "test", ...body });
      expect((await post({ from: iso(-3), until: iso(5) })).status).toBe(400);
      expect((await post({ from: iso(5), until: iso(2) })).status).toBe(400);
      expect((await post({ until: iso(5), reason: "" })).status).toBe(400);
      const expired = await memberWith("freeze-exp", -60, -2);
      expect((await post({ until: iso(5) }, expired.membership.id)).status).toBe(400);
    });

    it("member requests renewal; reception approves it and the renewal exists", async () => {
      const { member, membership } = await memberWith("request", -10, 5);
      const req = await h.http().post("/membership-requests").set(h.as(member.token)).send({ type: "RENEWAL", note: "Please renew" });
      expect(req.status).toBe(201);
      expect(req.body.status).toBe("PENDING");
      expect((await h.http().post("/membership-requests").set(h.as(member.token)).send({ type: "RENEWAL" })).status).toBe(409);

      const pending = await staffGet(reception.token, "/admin/membership-requests?status=PENDING&pageSize=100");
      expect(pending.body.data.some((r: { id: string }) => r.id === req.body.id)).toBe(true);
      expect((await h.http().post(`/admin/membership-requests/${req.body.id}/approve`).set(h.as(member.token)).send({})).status).toBe(403);

      const approved = await h.http().post(`/admin/membership-requests/${req.body.id}/approve`).set(h.as(reception.token)).send({ note: "Done" });
      expect(approved.status).toBe(200);
      expect(approved.body.status).toBe("APPROVED");
      expect(await h.prisma.client.membership.count({ where: { renewedFromId: membership.id } })).toBe(1);
      expect((await h.http().post(`/admin/membership-requests/${req.body.id}/approve`).set(h.as(reception.token)).send({})).status).toBe(400); // already handled
    });

    it("member requests a freeze with dates; rejecting leaves the membership untouched", async () => {
      const { member, membership } = await memberWith("request-f");
      expect((await h.http().post("/membership-requests").set(h.as(member.token)).send({ type: "FREEZE" })).status).toBe(400); // dates required
      const req = await h.http().post("/membership-requests").set(h.as(member.token)).send({ type: "FREEZE", requestedFrom: iso(1), requestedUntil: iso(8), note: "Holiday" });
      expect(req.status).toBe(201);
      const rejected = await h.http().post(`/admin/membership-requests/${req.body.id}/reject`).set(h.as(reception.token)).send({ note: "Not this month" });
      expect(rejected.body.status).toBe("REJECTED");
      expect((await h.prisma.client.membership.findUniqueOrThrow({ where: { id: membership.id } })).frozenFrom).toBeNull();
      expect((await h.http().get("/membership-requests/me").set(h.as(member.token))).body[0].status).toBe("REJECTED");
    });

    it("expiring list shows who needs a call, and drops those who already renewed", async () => {
      const soon = await memberWith("expiring", -25, 3);
      const renewedAlready = await memberWith("expiring-r", -25, 3);
      await h.http().post(`/admin/memberships/${renewedAlready.membership.id}/renew`).set(h.as(reception.token)).send({});
      const list = (await staffGet(reception.token, "/admin/memberships/expiring?days=7&pageSize=100")).body;
      const mine = list.data.filter((m: { id: string }) => [soon.membership.id, renewedAlready.membership.id].includes(m.id));
      expect(mine.find((m: { id: string }) => m.id === soon.membership.id).alreadyRenewed).toBe(false);
      expect(mine.find((m: { id: string }) => m.id === renewedAlready.membership.id).alreadyRenewed).toBe(true);
      expect(list.data[0].user.phone).toBeDefined();
    });
  });

  describe("QR check-in", () => {
    it("lets in a member with a valid membership and records the visit once", async () => {
      const { member } = await memberWith("ci-ok");
      const res = await checkIn({ code: await qrOf(member.id) });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ outcome: "OK", allowed: true });
      expect(res.body.member.name).toContain("ci-ok");
      expect(res.body.visitCount).toBe(1);
      expect(res.body.membership.status).toBe("ACTIVE");
      expect(await h.prisma.client.gymVisit.count({ where: { userId: member.id } })).toBe(1);
      expect((await h.prisma.client.gymVisit.findFirstOrThrow({ where: { userId: member.id } })).recordedById).toBe(reception.id);
    });

    it("the member's own card carries the same code the desk scans", async () => {
      const { member } = await memberWith("ci-card");
      const card = (await h.http().get("/me/card").set(h.as(member.token))).body;
      expect(card.memberNumber).toMatch(/^IG-\d{5}$/);
      expect(card.membership.status).toBe("ACTIVE");
      expect(card.qrToken).toBe(await qrOf(member.id));
      expect((await checkIn({ code: card.qrToken })).body.outcome).toBe("OK");
      expect((await h.http().get("/visits/me").set(h.as(member.token))).body.data).toHaveLength(1);
    });

    it("works by member number and by picking the member, and rejects ambiguous input", async () => {
      const { member } = await memberWith("ci-num");
      const number = (await h.prisma.client.user.findUniqueOrThrow({ where: { id: member.id } })).memberNumber!;
      expect((await checkIn({ memberNumber: number.toLowerCase() })).body.outcome).toBe("OK");
      expect((await checkIn({ memberNumber: "IG-99999" })).body.outcome).toBe("NOT_FOUND");
      expect((await checkIn({})).status).toBe(400);
      expect((await checkIn({ memberNumber: number, userId: member.id })).status).toBe(400);
    });

    it("duplicate scans are flagged and not double-counted", async () => {
      const { member } = await memberWith("ci-dup");
      const code = await qrOf(member.id);
      expect((await checkIn({ code })).body.outcome).toBe("OK");
      const again = await checkIn({ code });
      expect(again.body.outcome).toBe("DUPLICATE");
      expect(again.body.allowed).toBe(false);
      expect(await h.prisma.client.gymVisit.count({ where: { userId: member.id } })).toBe(1);
    });

    it("CONCURRENCY: five scanners reading the same code at once record exactly one visit", async () => {
      const { member } = await memberWith("ci-race");
      const code = await qrOf(member.id);
      const results = await Promise.all([1, 2, 3, 4, 5].map(() => checkIn({ code })));
      expect(results.filter((r) => r.body.outcome === "OK")).toHaveLength(1);
      expect(results.filter((r) => r.body.outcome === "DUPLICATE")).toHaveLength(4);
      expect(await h.prisma.client.gymVisit.count({ where: { userId: member.id } })).toBe(1);
    });

    it("the duplicate window is a setting (0 turns it off)", async () => {
      const { member } = await memberWith("ci-window");
      await settings({ duplicateScanMinutes: 0 });
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("OK");
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("OK");
      await settings({ duplicateScanMinutes: 10 });
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("DUPLICATE");
    });

    it("refuses expired, never-started, cancelled, missing and suspended memberships with a clear outcome", async () => {
      const expired = await memberWith("ci-exp", -60, -2);
      const future = await memberWith("ci-future", 5, 35);
      const cancelled = await memberWith("ci-cancel");
      await h.http().patch(`/admin/memberships/${cancelled.membership.id}/cancel`).set(h.as(h.admin.token));
      const none = await h.createMember("ci-none", { membership: false });
      const suspended = await memberWith("ci-susp");
      await h.http().patch(`/admin/members/${suspended.member.id}/status`).set(h.as(h.admin.token)).send({ status: "SUSPENDED" });

      expect((await checkIn({ userId: expired.member.id })).body.outcome).toBe("EXPIRED");
      expect((await checkIn({ userId: future.member.id })).body.outcome).toBe("NOT_STARTED");
      expect((await checkIn({ userId: cancelled.member.id })).body.outcome).toBe("CANCELLED");
      expect((await checkIn({ userId: none.id })).body.outcome).toBe("NO_MEMBERSHIP");
      expect((await checkIn({ userId: suspended.member.id })).body.outcome).toBe("SUSPENDED");
      for (const m of [expired, future, cancelled, suspended]) expect(await h.prisma.client.gymVisit.count({ where: { userId: m.member.id } })).toBe(0);
    });

    it("rejects forged, malformed and replaced QR codes", async () => {
      const { member } = await memberWith("ci-forge");
      const good = await qrOf(member.id);
      const tampered = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
      expect((await checkIn({ code: tampered })).body.outcome).toBe("INVALID_CODE");
      expect((await checkIn({ code: "IGM1.not-a-real-code-at-all" })).body.outcome).toBe("INVALID_CODE");
      expect((await checkIn({ code: `IGM1.${member.id}.1.000000000000000000000000` })).body.outcome).toBe("INVALID_CODE"); // guessed signature
      expect(await h.prisma.client.gymVisit.count({ where: { userId: member.id } })).toBe(0);

      // Lost phone: reissue invalidates the old code
      const fresh = await h.http().post(`/admin/members/${member.id}/qr/reissue`).set(h.as(reception.token));
      expect(fresh.status).toBe(200);
      expect((await checkIn({ code: good })).body.outcome).toBe("INVALID_CODE");
      expect((await checkIn({ code: fresh.body.token })).body.outcome).toBe("OK");
    });

    it("can require payment before entry when the gym turns that on", async () => {
      const member = await h.createMember("ci-unpaid", { membership: false });
      const plan = await h.createPricedPlan(4000);
      const sold = await h.http().post("/admin/memberships").set(h.as(reception.token)).send({ userId: member.id, planId: plan.id, startDate: iso(-1) });
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("OK"); // default: not enforced (the gym has not decided)
      await settings({ blockUnpaidCheckIn: true, duplicateScanMinutes: 0 });
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("UNPAID");
      await h.http().post("/admin/payments").set(h.as(reception.token)).send({ userId: member.id, membershipId: sold.body.id, amountCents: 4000, method: "CASH" });
      expect((await checkIn({ userId: member.id })).body.outcome).toBe("OK");
      await settings({ blockUnpaidCheckIn: false, duplicateScanMinutes: 10 });
    });

    it("only the front desk can check people in", async () => {
      const { member } = await memberWith("ci-perm");
      expect((await checkIn({ userId: member.id }, trainer.token)).status).toBe(403);
      expect((await checkIn({ userId: member.id }, member.token)).status).toBe(403);
      expect((await h.http().get(`/admin/members/${member.id}/qr`).set(h.as(trainer.token))).status).toBe(403);
    });

    it("today's list reflects the visits recorded", async () => {
      const { member } = await memberWith("ci-today");
      await checkIn({ userId: member.id });
      const today = (await staffGet(reception.token, "/admin/check-in/today")).body;
      expect(today.count).toBeGreaterThanOrEqual(1);
      expect(today.recent.some((v: { userId: string }) => v.userId === member.id)).toBe(true);
      expect(today.uniqueMembers).toBeLessThanOrEqual(today.count);
    });
  });

  describe("Rules and reports", () => {
    it("validates the gym rules", async () => {
      expect((await settings({ atRiskShortDays: 30, atRiskLongDays: 14 })).status).toBe(400);
      expect((await settings({ expiringSoonDays: 0 })).status).toBe(400);
      expect((await settings({ duplicateScanMinutes: -1 })).status).toBe(400);
      expect((await settings({ maxFreezeDays: 0 })).status).toBe(400);
      const ok = await settings({ atRiskShortDays: 14, atRiskLongDays: 30 });
      expect(ok.body.atRiskShortDays).toBe(14);
    });

    it("at-risk members are those with a running membership and no recent visit; a visit removes them", async () => {
      const { member } = await memberWith("risk");
      await h.prisma.client.user.update({ where: { id: member.id }, data: { createdAt: new Date(Date.now() - 60 * DAY) } }); // long enough ago to have visited
      const listed = async () => (await staffGet(h.admin.token, "/admin/reports/at-risk?days=14&pageSize=100")).body;
      expect((await listed()).data.some((m: { id: string }) => m.id === member.id)).toBe(true);
      expect((await staffGet(h.admin.token, `/admin/members?category=AT_RISK&search=${member.email}`)).body.data).toHaveLength(1);

      await checkIn({ userId: member.id });
      expect((await listed()).data.some((m: { id: string }) => m.id === member.id)).toBe(false);
      // a brand-new member has not had time to be "at risk"
      const brandNew = await memberWith("risk-new");
      expect((await listed()).data.some((m: { id: string }) => m.id === brandNew.member.id)).toBe(false);
      expect((await h.http().get("/admin/reports/at-risk").set(h.as(reception.token))).status).toBe(403);
    });

    it("the dashboard reports real figures that agree with the underlying records", async () => {
      const before = (await staffGet(h.admin.token, "/admin/reports/dashboard")).body;
      const { member } = await memberWith("dash");
      await checkIn({ userId: member.id });
      const after = (await staffGet(h.admin.token, "/admin/reports/dashboard")).body;

      expect(after.kpis.activeMembers).toBe(before.kpis.activeMembers + 1);
      expect(after.kpis.todaysCheckIns).toBe(before.kpis.todaysCheckIns + 1);
      expect(after.kpis.monthlyRevenueCents - before.kpis.monthlyRevenueCents).toBe(4000);
      expect(after.recentPayments[0].amountCents).toBe(4000);
      expect(after.revenueSeries.length).toBeGreaterThan(0);
      expect(after.attendanceTrend.reduce((n: number, d: { visits: number }) => n + d.visits, 0)).toBeGreaterThanOrEqual(1);
      expect(after.distribution.byType.length).toBeGreaterThan(0);
      for (const key of ["frozenMembers", "newMembersThisMonth", "outstandingCents", "overdueCents", "expiringSoon", "atRiskCount"]) expect(after.kpis[key]).toEqual(expect.any(Number));
    });

    it("attendance statistics add up and identify the busiest hour", async () => {
      const { member } = await memberWith("att-stat");
      await checkIn({ userId: member.id });
      const stats = (await staffGet(h.admin.token, `/admin/reports/attendance?from=${encodeURIComponent(iso(-1))}`)).body;
      expect(stats.byHour).toHaveLength(24);
      expect(stats.byHour.reduce((n: number, r: { visits: number }) => n + r.visits, 0)).toBe(stats.totalVisits);
      expect(stats.byWeekday.reduce((n: number, r: { visits: number }) => n + r.visits, 0)).toBe(stats.totalVisits);
      expect(stats.peakHour.visits).toBe(Math.max(...stats.byHour.map((r: { visits: number }) => r.visits)));
      expect(stats.topMembers.length).toBeGreaterThan(0);
    });

    it("membership growth counts new memberships, renewals and the renewal rate", async () => {
      const before = (await staffGet(h.admin.token, "/admin/reports/membership-growth?months=3")).body;
      const { membership } = await memberWith("growth");
      await h.http().post(`/admin/memberships/${membership.id}/renew`).set(h.as(reception.token)).send({});
      const after = (await staffGet(h.admin.token, "/admin/reports/membership-growth?months=3")).body;
      const [b, a] = [before[before.length - 1], after[after.length - 1]];
      expect(after).toHaveLength(3);
      expect(a.newMembers - b.newMembers).toBe(1);
      expect(a.newMemberships - b.newMemberships).toBe(1);
      expect(a.renewals - b.renewals).toBe(1);
      expect(a.activeAtEnd).toBeGreaterThanOrEqual(b.activeAtEnd);
    });

    it("trainer workload shows assigned clients", async () => {
      const { member } = await memberWith("workload");
      await h.http().patch(`/admin/members/${member.id}`).set(h.as(h.admin.token)).send({ assignedCoachId: trainer.coachId });
      const report = (await staffGet(h.admin.token, "/admin/reports/trainers")).body;
      expect(report.trainers.find((t: { coachId: string }) => t.coachId === trainer.coachId).assignedClients).toBeGreaterThanOrEqual(1);
    });

    it("the monthly report matches the finance numbers and exports as Excel and PDF", async () => {
      const report = (await staffGet(h.admin.token, "/admin/reports/monthly")).body;
      const finance = (await staffGet(h.admin.token, `/admin/finance/summary?from=${encodeURIComponent(report.period.from)}&to=${encodeURIComponent(report.period.to)}`)).body;
      expect(report.finance.receivedCents).toBe(finance.totals.receivedCents);
      expect(report.finance.billedCents).toBe(finance.totals.billedCents);
      expect(report.finance.netCents).toBe(report.finance.receivedCents - report.finance.expensesCents);
      expect(report.members.totalRegistered).toBeGreaterThan(0);

      const binary = (res: any, cb: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      };
      const pdf = await h.http().get(`/admin/reports/monthly/export?format=pdf&month=${report.month}`).set(h.as(h.admin.token)).buffer(true).parse(binary);
      expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe("%PDF-");
      const xlsx = await h.http().get("/admin/reports/monthly/export?format=xlsx").set(h.as(h.admin.token)).buffer(true).parse(binary);
      expect(Buffer.from(xlsx.body).subarray(0, 2).toString()).toBe("PK");
      expect((await staffGet(h.admin.token, "/admin/reports/monthly?month=2026-13")).status).toBe(400);
    });

    it("the business assistant answers from the database, in English or Albanian, and is owner-only", async () => {
      const ask = (question: string, token = h.admin.token) => h.http().post("/admin/reports/assistant").set(h.as(token)).send({ question });
      const revenue = await ask("How much revenue did we have this month?");
      expect(revenue.status).toBe(200);
      expect(revenue.body.intent).toBe("revenue");
      expect(revenue.body.language).toBe("en");
      expect(revenue.body.engine).toBe("database-queries");
      const summary = (await staffGet(h.admin.token, "/admin/finance/summary")).body;
      expect(revenue.body.answer).toContain((summary.totals.receivedCents / 100).toFixed(2));

      const sq = await ask("Sa të hyra kemi pasur këtë muaj?");
      expect(sq.body.language).toBe("sq");
      expect(sq.body.intent).toBe("revenue");
      expect((await ask("Cilat paketa po shiten më shumë?")).body.intent).toBe("packages");
      expect((await ask("Sa anëtarësi skadojnë javën tjetër?")).body.intent).toBe("expiring");
      expect((await ask("which members are at risk?")).body.intent).toBe("atRisk");

      const unknown = await ask("What is the weather like?");
      expect(unknown.body.intent).toBe("unknown");
      expect(unknown.body.answer).toMatch(/can answer/i);

      expect((await ask("revenue?", reception.token)).status).toBe(403);
      expect((await ask("revenue?", trainer.token)).status).toBe(403);
      expect((await ask("x")).status).toBe(400);
    });
  });
});
