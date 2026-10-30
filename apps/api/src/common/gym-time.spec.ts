import { currentStreakDays, gymDateString, gymTodayDate } from "./gym-time";

describe("gym-time", () => {
  it("resolves the gym calendar date, not the UTC date", () => {
    // 23:30 UTC on 1 Jan is already 2 Jan in Belgrade (UTC+1 in winter).
    const at = new Date("2027-01-01T23:30:00Z");
    expect(gymDateString(at, "Europe/Belgrade")).toBe("2027-01-02");
    expect(gymDateString(at, "UTC")).toBe("2027-01-01");
  });

  it("gymTodayDate is UTC midnight of the gym calendar date", () => {
    const d = gymTodayDate("Europe/Belgrade", new Date("2027-01-01T23:30:00Z"));
    expect(d.toISOString()).toBe("2027-01-02T00:00:00.000Z");
  });

  describe("currentStreakDays", () => {
    it("counts consecutive days ending today", () => {
      expect(currentStreakDays(["2027-03-10", "2027-03-09", "2027-03-08"], "2027-03-10")).toBe(3);
    });
    it("keeps the streak alive when the last activity was yesterday", () => {
      expect(currentStreakDays(["2027-03-09", "2027-03-08"], "2027-03-10")).toBe(2);
    });
    it("is zero when the last activity is older than yesterday", () => {
      expect(currentStreakDays(["2027-03-07"], "2027-03-10")).toBe(0);
    });
    it("stops at the first gap", () => {
      expect(currentStreakDays(["2027-03-10", "2027-03-09", "2027-03-07"], "2027-03-10")).toBe(2);
    });
    it("is zero with no activity and ignores duplicates", () => {
      expect(currentStreakDays([], "2027-03-10")).toBe(0);
      expect(currentStreakDays(["2027-03-10", "2027-03-10"], "2027-03-10")).toBe(1);
    });
    it("crosses month boundaries", () => {
      expect(currentStreakDays(["2027-03-01", "2027-02-28"], "2027-03-01")).toBe(2);
    });
  });
});

import { gymDayStart, gymPeriodStart, tzOffsetMinutes } from "./gym-time";

describe("gym calendar boundaries", () => {
  it("knows the Belgrade offset in winter and summer", () => {
    expect(tzOffsetMinutes("Europe/Belgrade", new Date("2026-01-15T12:00:00Z"))).toBe(60);
    expect(tzOffsetMinutes("Europe/Belgrade", new Date("2026-07-15T12:00:00Z"))).toBe(120);
  });

  it("local midnight is an earlier UTC instant by the offset", () => {
    expect(gymDayStart("2026-01-15", "Europe/Belgrade").toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(gymDayStart("2026-07-15", "Europe/Belgrade").toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("handles the daylight-saving switch day (clocks go forward at 02:00 on 2026-03-29)", () => {
    expect(gymDayStart("2026-03-29", "Europe/Belgrade").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(gymDayStart("2026-03-30", "Europe/Belgrade").toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("month and week starts follow the gym calendar, not UTC", () => {
    // 23:30 UTC on 31 Jan is already 1 Feb in Belgrade
    const now = new Date("2026-01-31T23:30:00Z");
    expect(gymPeriodStart("month", "Europe/Belgrade", now).toISOString()).toBe("2026-01-31T23:00:00.000Z");
    // Wed 2026-10-21 -> week starts Mon 2026-10-19 (local midnight = 22:00Z the evening before in summer time)
    expect(gymPeriodStart("week", "Europe/Belgrade", new Date("2026-10-21T10:00:00Z")).toISOString()).toBe("2026-10-18T22:00:00.000Z");
  });
});
