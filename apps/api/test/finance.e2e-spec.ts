import { createHarness } from "./support/harness";

/**
 * Payments, invoices and expenses, end to end. The rules under test (requirements 3.D):
 *  - a payment is linked to the member, the invoice and the membership, and updates the membership's payment status
 *  - full and partial payments; the balance is invoice total minus RECEIVED payments
 *  - corrections/cancellations are owner-only and leave a history
 *  - reports count money RECEIVED - never invoices - and keep billed / received / outstanding / expenses apart
 */
describe("Finance (e2e)", () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  let reception: Awaited<ReturnType<typeof h.createReceptionist>>;
  let trainer: Awaited<ReturnType<typeof h.createTrainer>>;
  const startedAt = new Date(Date.now() - 60_000);

  // supertest hands the raw response stream to a custom parser; collect it into a Buffer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const binary = (res: any, cb: any) => {
    const chunks: Buffer[] = [];
    res.on("data", (c: Buffer) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  };

  /** Sells a priced membership to a fresh member and returns everything needed to pay it. */
  async function sell(label: string, priceCents: number, extra: Record<string, unknown> = {}) {
    const member = await h.createMember(label, { membership: false });
    const plan = await h.createPricedPlan(priceCents);
    const res = await h.http().post("/admin/memberships").set(h.as(reception.token)).send({
      userId: member.id,
      planId: plan.id,
      startDate: new Date().toISOString(),
      ...extra,
    });
    expect(res.status).toBe(201);
    return { member, plan, membership: res.body, invoiceId: res.body.invoiceId as string };
  }

  const pay = (token: string, body: Record<string, unknown>) => h.http().post("/admin/payments").set(h.as(token)).send(body);
  const invoice = async (id: string) => (await h.http().get(`/admin/invoices/${id}`).set(h.as(h.admin.token))).body;
  const summary = async (query = "") => (await h.http().get(`/admin/finance/summary?from=${encodeURIComponent(startedAt.toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 3_600_000).toISOString())}${query}`).set(h.as(h.admin.token))).body;

  beforeAll(async () => {
    h = await createHarness("e2e-fin");
    reception = await h.createReceptionist("desk");
    trainer = await h.createTrainer("coach");
  });
  afterAll(async () => h.cleanup());

  describe("Selling a membership creates its invoice", () => {
    it("issues a uniquely numbered invoice at the price the member is charged, with the discount recorded", async () => {
      const promo = await h.http().post("/promotions").set(h.as(h.admin.token)).send({ name: `${h.tag} 10% off`, percentOff: 10 });
      expect(promo.status).toBe(201);

      const a = await sell("sale-a", 5000, { promotionId: promo.body.id });
      const b = await sell("sale-b", 5000);
      const invA = await invoice(a.invoiceId);
      const invB = await invoice(b.invoiceId);

      expect(invA.number).toMatch(/^INV-\d{4}-\d{6}$/);
      expect(invA.number).not.toBe(invB.number);
      expect(invA.subtotalCents).toBe(5000);
      expect(invA.discountCents).toBe(500);
      expect(invA.totalCents).toBe(4500); // 10% off
      expect(invA.balanceCents).toBe(4500);
      expect(invA.displayStatus).toBe("PENDING");
      expect(invB.totalCents).toBe(5000);
      // The membership remembers the price it was sold at, and shows as unpaid until money arrives
      expect(a.membership.priceCents).toBe(5000);
      expect(a.membership.discountCents).toBe(500);
      expect(a.membership.paymentStatus).toBe("UNPAID");
    });

    it("a promotion that is not currently valid is refused", async () => {
      const promo = await h.http().post("/promotions").set(h.as(h.admin.token)).send({ name: `${h.tag} expired`, percentOff: 50, validTo: new Date(Date.now() - 86_400_000).toISOString() });
      const member = await h.createMember("sale-bad", { membership: false });
      const plan = await h.createPricedPlan(3000);
      const res = await h.http().post("/admin/memberships").set(h.as(h.admin.token)).send({ userId: member.id, planId: plan.id, startDate: new Date().toISOString(), promotionId: promo.body.id });
      expect(res.status).toBe(400);
    });

    it("records a first payment in the same transaction (partial -> PARTIAL, full -> PAID)", async () => {
      const partial = await sell("sale-c", 6000, { initialPayment: { amountCents: 2000, method: "CASH" } });
      expect((await invoice(partial.invoiceId)).displayStatus).toBe("PARTIAL");
      expect(partial.membership.paymentStatus).toBe("PARTIAL");

      const full = await sell("sale-d", 6000, { initialPayment: { amountCents: 6000, method: "CARD", reference: "SLIP-1" } });
      expect((await invoice(full.invoiceId)).displayStatus).toBe("PAID");
      expect(full.membership.paymentStatus).toBe("PAID");
    });

    it("refuses an initial payment when there is no price to pay", async () => {
      const member = await h.createMember("sale-nop", { membership: false });
      const plan = await h.http().post("/membership-plans").set(h.as(h.admin.token)).send({ name: `${h.tag} noprice`, durationDays: 30 });
      const res = await h.http().post("/admin/memberships").set(h.as(h.admin.token)).send({ userId: member.id, planId: plan.body.id, startDate: new Date().toISOString(), initialPayment: { amountCents: 1000, method: "CASH" } });
      expect(res.status).toBe(400);
      // and with no price, no invoice is invented
      const ok = await h.http().post("/admin/memberships").set(h.as(h.admin.token)).send({ userId: member.id, planId: plan.body.id, startDate: new Date().toISOString(), paymentStatus: "PAID" });
      expect(ok.status).toBe(201);
      expect(ok.body.invoiceId).toBeNull();
    });
  });

  describe("Recording payments", () => {
    it("links the payment to the member, invoice and membership, updates the status, and notifies the member", async () => {
      const s = await sell("pay-a", 5000);
      const first = await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 2000, method: "CASH" });
      expect(first.status).toBe(201);
      expect(first.body.membershipId).toBe(s.membership.id);
      expect(first.body.user.id).toBe(s.member.id);
      expect((await invoice(s.invoiceId)).balanceCents).toBe(3000);

      const second = await pay(reception.token, { userId: s.member.id, membershipId: s.membership.id, amountCents: 3000, method: "BANK", reference: "TRX-77" });
      expect(second.status).toBe(201); // applied to the membership's open invoice without naming it
      expect(second.body.invoiceId).toBe(s.invoiceId);

      const inv = await invoice(s.invoiceId);
      expect(inv.displayStatus).toBe("PAID");
      expect(inv.paidCents).toBe(5000);
      const mine = await h.http().get("/memberships/me").set(h.as(s.member.token));
      expect(mine.body.paymentStatus).toBe("PAID");

      const notes = await h.http().get("/notifications/me").set(h.as(s.member.token));
      expect(notes.body.data.filter((n: { type: string }) => n.type === "PAYMENT_RECEIVED")).toHaveLength(2);
    });

    it("rejects overpayment, payment on a paid invoice, a different member's invoice, and bad amounts", async () => {
      const s = await sell("pay-b", 4000, { initialPayment: { amountCents: 1000, method: "CASH" } });
      const other = await h.createMember("pay-other", { membership: false });

      expect((await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 3001, method: "CASH" })).status).toBe(400); // balance is 3000
      expect((await pay(reception.token, { userId: other.id, invoiceId: s.invoiceId, amountCents: 100, method: "CASH" })).status).toBe(400);
      expect((await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 0, method: "CASH" })).status).toBe(400);
      expect((await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: -5, method: "CASH" })).status).toBe(400);
      expect((await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 100, method: "BITCOIN" })).status).toBe(400);
      expect((await pay(reception.token, { userId: s.member.id, amountCents: 100, method: "CASH" })).status).toBe(400); // nothing to apply it to

      expect((await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 3000, method: "CASH" })).status).toBe(201);
      expect((await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 1, method: "CASH" })).status).toBe(400); // already paid
    });

    it("CONCURRENCY: simultaneous payments can never exceed the invoice total", async () => {
      const s = await sell("pay-race", 5000);
      const results = await Promise.all([1, 2, 3, 4].map(() => pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 2000, method: "CASH" })));
      const ok = results.filter((r) => r.status === 201).length;
      expect(ok).toBe(2); // 2 x 2000 fits in 5000; a third would not
      expect(results.filter((r) => r.status === 400)).toHaveLength(2);
      const inv = await invoice(s.invoiceId);
      expect(inv.paidCents).toBe(4000);
      expect(inv.balanceCents).toBe(1000);
    });

    it("only staff can record payments; trainers and members cannot", async () => {
      const s = await sell("pay-perm", 3000);
      expect((await pay(trainer.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 100, method: "CASH" })).status).toBe(403);
      expect((await pay(s.member.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 100, method: "CASH" })).status).toBe(403);
    });
  });

  describe("Corrections and cancellations (owner only, with history)", () => {
    it("reception can record but cannot void or correct; the owner can, with a mandatory reason", async () => {
      const s = await sell("fix-a", 5000, { initialPayment: { amountCents: 5000, method: "CASH" } });
      const payment = (await h.http().get(`/admin/payments?invoiceId=${s.invoiceId}`).set(h.as(h.admin.token))).body.data[0];

      expect((await h.http().patch(`/admin/payments/${payment.id}/void`).set(h.as(reception.token)).send({ reason: "typo" })).status).toBe(403);
      expect((await h.http().patch(`/admin/payments/${payment.id}/correct`).set(h.as(reception.token)).send({ amountCents: 10, reason: "typo" })).status).toBe(403);
      expect((await h.http().patch(`/admin/payments/${payment.id}/void`).set(h.as(h.admin.token)).send({})).status).toBe(400); // reason required

      const voided = await h.http().patch(`/admin/payments/${payment.id}/void`).set(h.as(h.admin.token)).send({ reason: "Recorded on the wrong member" });
      expect(voided.status).toBe(200);
      expect(voided.body.status).toBe("VOIDED");

      // The payment stays on record, stops counting as money received, and the invoice is open again
      const inv = await invoice(s.invoiceId);
      expect(inv.balanceCents).toBe(5000);
      expect(inv.displayStatus).not.toBe("PAID");
      expect((await h.http().get("/memberships/me").set(h.as(s.member.token))).body.paymentStatus).toBe("UNPAID");
      expect((await h.http().patch(`/admin/payments/${payment.id}/void`).set(h.as(h.admin.token)).send({ reason: "again" })).status).toBe(400);

      const log = await h.prisma.client.auditLog.findFirst({ where: { action: "payment.void", entityId: payment.id } });
      expect(log?.actorId).toBe(h.admin.id);
      expect(JSON.stringify(log?.metadata)).toContain("Recorded on the wrong member");
    });

    it("a correction changes the record and logs before/after; it cannot push the invoice over its total", async () => {
      const s = await sell("fix-b", 5000, { initialPayment: { amountCents: 2000, method: "CASH" } });
      const payment = (await h.http().get(`/admin/payments?invoiceId=${s.invoiceId}`).set(h.as(h.admin.token))).body.data[0];

      const tooMuch = await h.http().patch(`/admin/payments/${payment.id}/correct`).set(h.as(h.admin.token)).send({ amountCents: 5001, reason: "typo" });
      expect(tooMuch.status).toBe(400);

      const fixed = await h.http().patch(`/admin/payments/${payment.id}/correct`).set(h.as(h.admin.token)).send({ amountCents: 2500, method: "BANK", reason: "Receipt said 25.00 by transfer" });
      expect(fixed.status).toBe(200);
      expect(fixed.body.amountCents).toBe(2500);
      expect(fixed.body.method).toBe("BANK");
      const log = await h.prisma.client.auditLog.findFirst({ where: { action: "payment.correct", entityId: payment.id } });
      const meta = log?.metadata as { before: { amountCents: number }; after: { amountCents: number } };
      expect(meta.before.amountCents).toBe(2000);
      expect(meta.after.amountCents).toBe(2500);
      expect((await invoice(s.invoiceId)).balanceCents).toBe(2500);
    });

    it("an invoice with money received cannot be voided until those payments are voided", async () => {
      const s = await sell("fix-c", 3000, { initialPayment: { amountCents: 1000, method: "CASH" } });
      expect((await h.http().patch(`/admin/invoices/${s.invoiceId}/void`).set(h.as(h.admin.token)).send({ reason: "mistake" })).status).toBe(400);

      const payment = (await h.http().get(`/admin/payments?invoiceId=${s.invoiceId}`).set(h.as(h.admin.token))).body.data[0];
      await h.http().patch(`/admin/payments/${payment.id}/void`).set(h.as(h.admin.token)).send({ reason: "refunded" });
      const voided = await h.http().patch(`/admin/invoices/${s.invoiceId}/void`).set(h.as(h.admin.token)).send({ reason: "Sold by mistake" });
      expect(voided.status).toBe(200);
      expect(voided.body.displayStatus).toBe("VOID");
      expect(voided.body.balanceCents).toBe(0);
      expect((await pay(reception.token, { userId: s.member.id, invoiceId: s.invoiceId, amountCents: 100, method: "CASH" })).status).toBe(400);
      // a voided invoice is hidden from the member
      expect((await h.http().get(`/invoices/me/${s.invoiceId}`).set(h.as(s.member.token))).status).toBe(404);
    });
  });

  describe("Invoice statuses and filters", () => {
    it("derives Pending / Partial / Paid / Overdue from the money and the due date", async () => {
      const member = await h.createMember("status", { membership: false });
      const make = async (due: string, desc: string) =>
        (await h.http().post("/admin/invoices").set(h.as(reception.token)).send({ userId: member.id, description: desc, dueDate: due, lines: [{ description: desc, amountCents: 1000 }] })).body;

      const overdue = await make(new Date(Date.now() - 5 * 86_400_000).toISOString(), "Overdue one");
      const pending = await make(new Date(Date.now() + 5 * 86_400_000).toISOString(), "Pending one");
      expect(overdue.displayStatus).toBe("OVERDUE");
      expect(pending.displayStatus).toBe("PENDING");

      const list = async (status: string) => (await h.http().get(`/admin/invoices?userId=${member.id}&status=${status}`).set(h.as(h.admin.token))).body.data.map((i: { id: string }) => i.id);
      expect(await list("OVERDUE")).toEqual([overdue.id]);
      expect(await list("PENDING")).toEqual([pending.id]);
      expect(await list("OUTSTANDING")).toHaveLength(2);

      await pay(reception.token, { userId: member.id, invoiceId: pending.id, amountCents: 400, method: "CASH" });
      expect(await list("PARTIAL")).toEqual([pending.id]);
      await pay(reception.token, { userId: member.id, invoiceId: pending.id, amountCents: 600, method: "CASH" });
      expect(await list("PAID")).toEqual([pending.id]);
    });

    it("validates manual invoices", async () => {
      const member = await h.createMember("inv-val", { membership: false });
      const send = (body: Record<string, unknown>) => h.http().post("/admin/invoices").set(h.as(reception.token)).send({ userId: member.id, description: "x", ...body });
      expect((await send({ lines: [] })).status).toBe(400);
      expect((await send({ lines: [{ description: "a", amountCents: 100 }], discountCents: 500 })).status).toBe(400);
      expect((await send({ lines: [{ description: "a", amountCents: -1 }] })).status).toBe(400);
    });
  });

  describe("Member's own billing", () => {
    it("shows what is owed, the next payment and invoice history - and only their own", async () => {
      const s = await sell("mine-a", 5000, { initialPayment: { amountCents: 1500, method: "CASH" } });
      const other = await sell("mine-b", 5000);

      const billing = await h.http().get("/billing/me").set(h.as(s.member.token));
      expect(billing.status).toBe(200);
      expect(billing.body.balanceCents).toBe(3500);
      expect(billing.body.totalPaidCents).toBe(1500);
      expect(billing.body.nextPayment.invoiceId).toBe(s.invoiceId);

      const invoices = await h.http().get("/invoices/me").set(h.as(s.member.token));
      expect(invoices.body.data.map((i: { id: string }) => i.id)).toEqual([s.invoiceId]);
      expect((await h.http().get(`/invoices/me/${other.invoiceId}`).set(h.as(s.member.token))).status).toBe(404);
      expect((await h.http().get(`/invoices/me/${other.invoiceId}/pdf`).set(h.as(s.member.token))).status).toBe(404);

      const payments = await h.http().get("/payments/me").set(h.as(s.member.token));
      expect(payments.body.data).toHaveLength(1);
      expect(payments.body.data[0].amountCents).toBe(1500);
    });

    it("downloads their invoice as a real PDF", async () => {
      const s = await sell("mine-pdf", 2500, { initialPayment: { amountCents: 2500, method: "CASH" } });
      const res = await h.http().get(`/invoices/me/${s.invoiceId}/pdf`).set(h.as(s.member.token)).buffer(true).parse(binary);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain(".pdf");
      expect(Buffer.from(res.body).subarray(0, 5).toString()).toBe("%PDF-");
      expect(Buffer.from(res.body).length).toBeGreaterThan(1000);
    });
  });

  describe("Expenses and reports: received money only", () => {
    it("expenses are owner-only, can be voided, and appear in the net result", async () => {
      expect((await h.http().post("/admin/expenses").set(h.as(reception.token)).send({ category: "RENT", description: "x", amountCents: 100, spentAt: new Date().toISOString() })).status).toBe(403);
      expect((await h.http().get("/admin/expenses").set(h.as(reception.token))).status).toBe(403);
      expect((await h.http().post("/admin/expenses").set(h.as(h.admin.token)).send({ category: "RENT", description: "x", amountCents: 0, spentAt: new Date().toISOString() })).status).toBe(400);

      const before = await summary();
      const rent = await h.http().post("/admin/expenses").set(h.as(h.admin.token)).send({ category: "RENT", description: `${h.tag} rent`, amountCents: 30_000, spentAt: new Date().toISOString() });
      const fix = await h.http().post("/admin/expenses").set(h.as(h.admin.token)).send({ category: "MAINTENANCE", description: `${h.tag} repair`, amountCents: 4_000, spentAt: new Date().toISOString() });
      expect(rent.status).toBe(201);
      const after = await summary();
      expect(after.totals.expensesCents - before.totals.expensesCents).toBe(34_000);
      expect(after.totals.netCents).toBe(after.totals.receivedCents - after.totals.expensesCents);

      await h.http().patch(`/admin/expenses/${fix.body.id}/void`).set(h.as(h.admin.token)).send({ reason: "Entered twice" });
      expect((await summary()).totals.expensesCents - before.totals.expensesCents).toBe(30_000);
    });

    it("revenue counts payments RECEIVED, never invoices or unpaid balances", async () => {
      const before = await summary();

      // 10,000 invoiced, only 4,000 received. 3,000 invoiced, nothing received.
      const a = await sell("rev-a", 10_000, { initialPayment: { amountCents: 4000, method: "CASH" } });
      await sell("rev-b", 3000);
      const after = await summary();

      expect(after.totals.billedCents - before.totals.billedCents).toBe(13_000);
      expect(after.totals.receivedCents - before.totals.receivedCents).toBe(4000); // NOT 13,000 and not 10,000
      expect(after.totals.outstandingCents - before.totals.outstandingCents).toBe(9000); // 6,000 + 3,000 still owed

      // A voided payment stops counting as revenue
      const p = (await h.http().get(`/admin/payments?invoiceId=${a.invoiceId}`).set(h.as(h.admin.token))).body.data[0];
      await h.http().patch(`/admin/payments/${p.id}/void`).set(h.as(h.admin.token)).send({ reason: "cancelled" });
      const voided = await summary();
      expect(voided.totals.receivedCents - before.totals.receivedCents).toBe(0);
      expect(voided.totals.outstandingCents - before.totals.outstandingCents).toBe(13_000);
    });

    it("filters by payment method and package, and breaks revenue down by both", async () => {
      const cash = await sell("flt-a", 2000, { initialPayment: { amountCents: 2000, method: "CASH" } });
      await sell("flt-b", 2000, { initialPayment: { amountCents: 1500, method: "CARD" } });

      const cashOnly = await summary("&method=CASH");
      expect(cashOnly.byMethod.every((m: { method: string }) => m.method === "CASH")).toBe(true);
      const byPlan = await summary(`&planId=${cash.plan.id}`);
      expect(byPlan.totals.receivedCents).toBe(2000);
      expect(byPlan.byPlan[0].name).toBe(cash.plan.name);

      const all = await summary();
      const methods = Object.fromEntries(all.byMethod.map((m: { method: string; cents: number }) => [m.method, m.cents]));
      expect(methods.CASH).toBeGreaterThanOrEqual(2000);
      expect(methods.CARD).toBeGreaterThanOrEqual(1500);
    });

    it("reports are owner-only", async () => {
      for (const path of ["/admin/finance/summary", "/admin/finance/export?type=summary&format=xlsx", "/admin/reports/dashboard", "/admin/reports/monthly"]) {
        expect((await h.http().get(path).set(h.as(reception.token))).status).toBe(403);
        expect((await h.http().get(path).set(h.as(trainer.token))).status).toBe(403);
      }
    });

    it("exports real Excel and PDF files", async () => {
      const from = encodeURIComponent(startedAt.toISOString());
      for (const type of ["summary", "payments", "invoices", "expenses"]) {
        const xlsx = await h.http().get(`/admin/finance/export?type=${type}&format=xlsx&from=${from}`).set(h.as(h.admin.token)).buffer(true).parse(binary);
        expect(xlsx.status).toBe(200);
        expect(xlsx.headers["content-type"]).toContain("spreadsheetml");
        expect(Buffer.from(xlsx.body).subarray(0, 2).toString()).toBe("PK"); // .xlsx is a zip

        const pdf = await h.http().get(`/admin/finance/export?type=${type}&format=pdf&from=${from}`).set(h.as(h.admin.token)).buffer(true).parse(binary);
        expect(pdf.status).toBe(200);
        expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe("%PDF-");
      }
      expect((await h.http().get("/admin/finance/export?type=nonsense&format=xlsx").set(h.as(h.admin.token))).status).toBe(400);
    });
  });
});
