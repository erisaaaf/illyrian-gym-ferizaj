// "Today" for a gym is a calendar date in the gym's own timezone, not the
// server's. WOD.date is a date-only column, so it is represented as UTC
// midnight of that calendar date everywhere (admin form, seed, queries).

export const DEFAULT_GYM_TIMEZONE = "Europe/Belgrade"; // Kosovo observes Central European Time

/** YYYY-MM-DD for the instant `at`, as seen on the wall clock in `timeZone`. */
export function gymDateString(at: Date, timeZone = DEFAULT_GYM_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** UTC midnight of the gym's current calendar date - the value stored in a date-only column. */
export function gymTodayDate(timeZone = DEFAULT_GYM_TIMEZONE, now = new Date()): Date {
  return new Date(`${gymDateString(now, timeZone)}T00:00:00.000Z`);
}

/**
 * Consecutive-day streak ending today or yesterday (a day with no activity yet
 * today doesn't break a streak that was alive yesterday).
 * `activityDates` are YYYY-MM-DD strings in the gym timezone, any order, duplicates allowed.
 */
export function currentStreakDays(activityDates: Iterable<string>, today: string): number {
  const days = new Set(activityDates);
  const shift = (ymd: string, delta: number) => {
    const d = new Date(`${ymd}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  let cursor = days.has(today) ? today : shift(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shift(cursor, -1);
  }
  return streak;
}

/** Offset of `timeZone` from UTC at a given instant, in minutes (e.g. Europe/Belgrade is +60 in winter, +120 in summer). */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** The instant the gym's calendar day `YYYY-MM-DD` begins (local midnight), correct across daylight-saving changes. */
export function gymDayStart(dateString: string, timeZone = DEFAULT_GYM_TIMEZONE): Date {
  const guess = new Date(`${dateString}T00:00:00.000Z`);
  const first = new Date(guess.getTime() - tzOffsetMinutes(timeZone, guess) * 60_000);
  return new Date(guess.getTime() - tzOffsetMinutes(timeZone, first) * 60_000);
}

/** Start (instant) of the gym's current day / month / ISO week - the boundaries reports are built on. */
export function gymPeriodStart(unit: "day" | "week" | "month", timeZone = DEFAULT_GYM_TIMEZONE, now: Date = new Date()): Date {
  const today = gymDateString(now, timeZone); // YYYY-MM-DD in the gym's calendar
  if (unit === "day") return gymDayStart(today, timeZone);
  if (unit === "month") return gymDayStart(`${today.slice(0, 7)}-01`, timeZone);
  const d = new Date(`${today}T00:00:00.000Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return gymDayStart(d.toISOString().slice(0, 10), timeZone);
}
