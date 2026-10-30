// Money logic kept pure (no database) so the business rules are easy to test and cannot drift.
//
// Three different things are kept apart on purpose (document 3.D: reports must not show wrong data):
//   Invoice  = what the member owes                -> "billed"
//   Payment  = money actually received (COMPLETED) -> the ONLY thing that counts as revenue
//   Balance  = invoice total - completed payments  -> outstanding debt

export type InvoiceDisplayStatus = "PAID" | "PARTIAL" | "PENDING" | "OVERDUE" | "VOID";

const DAY_MS = 86_400_000;

interface InvoiceLike {
  status: "OPEN" | "VOID";
  totalCents: number;
  dueDate: Date;
}

/**
 * The status the member and staff see. It is DERIVED from the invoice and its completed payments - never stored -
 * so voiding or correcting a payment can never leave a stale "Paid" behind.
 *
 *   VOID     the invoice was cancelled
 *   PAID     received >= total (a fully discounted 0-total invoice counts as paid)
 *   OVERDUE  money is still owed and the due date (end of that day) has passed
 *   PARTIAL  part has been received and it is not yet overdue
 *   PENDING  nothing received yet and it is not yet overdue
 */
export function deriveInvoiceStatus(invoice: InvoiceLike, paidCents: number, now: Date = new Date()): InvoiceDisplayStatus {
  if (invoice.status === "VOID") return "VOID";
  if (paidCents >= invoice.totalCents) return "PAID";
  if (invoice.dueDate.getTime() + DAY_MS < now.getTime()) return "OVERDUE";
  if (paidCents > 0) return "PARTIAL";
  return "PENDING";
}

export function sumCompleted(payments: Array<{ status: string; amountCents: number }>): number {
  return payments.reduce((sum, p) => (p.status === "COMPLETED" ? sum + p.amountCents : sum), 0);
}

export function balanceOf(invoice: InvoiceLike, paidCents: number): number {
  return invoice.status === "VOID" ? 0 : Math.max(0, invoice.totalCents - paidCents);
}

/** Derived payment status for a membership from its (non-void) invoices. Returns null when it has no invoices. */
export function membershipPaymentStatus(invoices: Array<{ totalCents: number; paidCents: number }>): "PAID" | "PARTIAL" | "UNPAID" | null {
  if (invoices.length === 0) return null;
  const total = invoices.reduce((n, i) => n + i.totalCents, 0);
  const paid = invoices.reduce((n, i) => n + Math.min(i.paidCents, i.totalCents), 0);
  if (paid >= total) return "PAID";
  return paid > 0 ? "PARTIAL" : "UNPAID";
}

/** Percentage or fixed discount applied to a price, never below zero and never above the price. */
export function applyDiscount(priceCents: number, discount: { percentOff?: number | null; amountOffCents?: number | null; extraCents?: number }): number {
  let off = 0;
  if (discount.percentOff) off += Math.round((priceCents * discount.percentOff) / 100);
  if (discount.amountOffCents) off += discount.amountOffCents;
  off += discount.extraCents ?? 0;
  return Math.min(Math.max(0, off), priceCents);
}

export function formatMoney(cents: number, currency = "EUR"): string {
  const symbol = currency === "EUR" ? "EUR " : `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
