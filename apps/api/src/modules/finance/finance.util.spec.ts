import { applyDiscount, balanceOf, deriveInvoiceStatus, membershipPaymentStatus, sumCompleted } from "./finance.util";

const day = 86_400_000;
const now = new Date("2026-10-20T12:00:00Z");
const inv = (over: Partial<{ status: "OPEN" | "VOID"; totalCents: number; dueDate: Date }> = {}) => ({
  status: "OPEN" as const,
  totalCents: 5000,
  dueDate: new Date(now.getTime() + 5 * day),
  ...over,
});

describe("deriveInvoiceStatus", () => {
  it("is PENDING when nothing was received and it is not due yet", () => {
    expect(deriveInvoiceStatus(inv(), 0, now)).toBe("PENDING");
  });
  it("is PARTIAL when some money was received and it is not overdue", () => {
    expect(deriveInvoiceStatus(inv(), 2000, now)).toBe("PARTIAL");
  });
  it("is PAID when received >= total", () => {
    expect(deriveInvoiceStatus(inv(), 5000, now)).toBe("PAID");
    expect(deriveInvoiceStatus(inv(), 5001, now)).toBe("PAID");
  });
  it("treats a fully discounted 0-total invoice as PAID", () => {
    expect(deriveInvoiceStatus(inv({ totalCents: 0 }), 0, now)).toBe("PAID");
  });
  it("is OVERDUE once the due day has fully passed and money is still owed (even if partly paid)", () => {
    const due = new Date(now.getTime() - 2 * day);
    expect(deriveInvoiceStatus(inv({ dueDate: due }), 0, now)).toBe("OVERDUE");
    expect(deriveInvoiceStatus(inv({ dueDate: due }), 1000, now)).toBe("OVERDUE");
  });
  it("is not overdue during the due day itself", () => {
    const dueEarlierToday = new Date("2026-10-20T00:00:00Z");
    expect(deriveInvoiceStatus(inv({ dueDate: dueEarlierToday }), 0, now)).toBe("PENDING");
  });
  it("a paid invoice is never overdue", () => {
    expect(deriveInvoiceStatus(inv({ dueDate: new Date(now.getTime() - 30 * day) }), 5000, now)).toBe("PAID");
  });
  it("VOID wins over everything", () => {
    expect(deriveInvoiceStatus(inv({ status: "VOID" }), 5000, now)).toBe("VOID");
  });
});

describe("balances and revenue", () => {
  it("only COMPLETED payments count; voided ones are ignored", () => {
    expect(
      sumCompleted([
        { status: "COMPLETED", amountCents: 3000 },
        { status: "VOIDED", amountCents: 9999 },
        { status: "COMPLETED", amountCents: 500 },
      ]),
    ).toBe(3500);
  });
  it("balance is total minus completed payments, never negative, and zero for a void invoice", () => {
    expect(balanceOf(inv(), 1500)).toBe(3500);
    expect(balanceOf(inv(), 9000)).toBe(0);
    expect(balanceOf(inv({ status: "VOID" }), 0)).toBe(0);
  });
  it("membership payment status is derived from its invoices", () => {
    expect(membershipPaymentStatus([])).toBeNull();
    expect(membershipPaymentStatus([{ totalCents: 5000, paidCents: 5000 }])).toBe("PAID");
    expect(membershipPaymentStatus([{ totalCents: 5000, paidCents: 2000 }])).toBe("PARTIAL");
    expect(membershipPaymentStatus([{ totalCents: 5000, paidCents: 0 }])).toBe("UNPAID");
    expect(membershipPaymentStatus([{ totalCents: 5000, paidCents: 5000 }, { totalCents: 3000, paidCents: 0 }])).toBe("PARTIAL");
  });
});

describe("applyDiscount", () => {
  it("applies a percentage", () => expect(applyDiscount(10000, { percentOff: 10 })).toBe(1000));
  it("applies a fixed amount", () => expect(applyDiscount(10000, { amountOffCents: 2500 })).toBe(2500));
  it("stacks promotion and extra, but never exceeds the price", () => {
    expect(applyDiscount(10000, { percentOff: 10, extraCents: 500 })).toBe(1500);
    expect(applyDiscount(1000, { amountOffCents: 5000 })).toBe(1000);
  });
  it("is zero with no discount", () => expect(applyDiscount(1000, {})).toBe(0));
});
