// Display formatting. Money is stored and transported as integer cents; it is only turned into text here.

const GYM_TZ = "Europe/Belgrade";

export function formatMoney(cents: number | null | undefined, currency = "EUR"): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

/** `12,50` or `12.5` typed by a person → integer cents, or null when it is not a valid non-negative amount. */
export function parseMoneyToCents(input: string): number | null {
  const normalised = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  return Math.round(Number(normalised) * 100);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

/** `2026-10` → `Oct 2026`; `2026-10-26` → `26 Oct`. Used for chart labels. */
export function shortPeriod(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m) return key;
  const date = new Date(Date.UTC(y, m - 1, d ?? 1));
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...(d ? { day: "numeric", month: "short" } : { month: "short" }) }).format(date);
}

export const PLAN_TYPE_LABEL: Record<string, string> = { GYM: "Gym", CROSSFIT: "CrossFit", COMBINED: "Gym + CrossFit" };
export const PLAN_PERIOD_LABEL: Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "3 months", SEMIANNUAL: "6 months", ANNUAL: "12 months", CUSTOM: "Custom" };
export const PAYMENT_METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bank transfer", CARD: "Card", OTHER: "Other" };
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function fullName(p: { firstName: string; lastName: string } | null | undefined): string {
  return p ? `${p.firstName} ${p.lastName}` : "—";
}
