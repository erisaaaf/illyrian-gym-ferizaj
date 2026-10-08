import { extractPrCandidate, isBetterPr } from "./pr-engine";

function result(overrides: Partial<{ weightKg: unknown; reps: number | null; durationSeconds: number | null; distanceMeters: unknown; rounds: number | null }> = {}) {
  return {
    weightKg: null,
    reps: null,
    durationSeconds: null,
    distanceMeters: null,
    rounds: null,
    ...overrides,
  };
}

describe("extractPrCandidate", () => {
  it("extracts weight in kg for MAX_WEIGHT", () => {
    expect(extractPrCandidate("MAX_WEIGHT", result({ weightKg: 100 }))).toEqual({ value: 100, unit: "KG" });
  });

  it("extracts reps for MAX_REPS", () => {
    expect(extractPrCandidate("MAX_REPS", result({ reps: 25 }))).toEqual({ value: 25, unit: "REPS" });
  });

  it("extracts duration in seconds for FASTEST_TIME", () => {
    expect(extractPrCandidate("FASTEST_TIME", result({ durationSeconds: 120 }))).toEqual({ value: 120, unit: "SECONDS" });
  });

  it("converts distance from meters to km for MAX_DISTANCE", () => {
    expect(extractPrCandidate("MAX_DISTANCE", result({ distanceMeters: 5000 }))).toEqual({ value: 5, unit: "KM" });
  });

  it("extracts rounds for MAX_ROUNDS", () => {
    expect(extractPrCandidate("MAX_ROUNDS", result({ rounds: 12 }))).toEqual({ value: 12, unit: "ROUNDS" });
  });

  it("returns null when the relevant field wasn't submitted", () => {
    expect(extractPrCandidate("MAX_WEIGHT", result({ reps: 10 }))).toBeNull();
  });

  it("handles Prisma Decimal-like objects via Number() coercion", () => {
    const decimalLike = { toString: () => "82.5", valueOf: () => 82.5 };
    expect(extractPrCandidate("MAX_WEIGHT", result({ weightKg: decimalLike }))).toEqual({ value: 82.5, unit: "KG" });
  });
});

describe("isBetterPr", () => {
  it("treats higher as better for MAX_WEIGHT", () => {
    expect(isBetterPr("MAX_WEIGHT", 105, 100)).toBe(true);
    expect(isBetterPr("MAX_WEIGHT", 95, 100)).toBe(false);
  });

  it("treats higher as better for MAX_REPS", () => {
    expect(isBetterPr("MAX_REPS", 26, 25)).toBe(true);
    expect(isBetterPr("MAX_REPS", 24, 25)).toBe(false);
  });

  it("treats higher as better for MAX_DISTANCE", () => {
    expect(isBetterPr("MAX_DISTANCE", 5.5, 5)).toBe(true);
  });

  it("treats higher as better for MAX_ROUNDS", () => {
    expect(isBetterPr("MAX_ROUNDS", 13, 12)).toBe(true);
  });

  it("treats lower as better for FASTEST_TIME", () => {
    expect(isBetterPr("FASTEST_TIME", 115, 120)).toBe(true);
    expect(isBetterPr("FASTEST_TIME", 125, 120)).toBe(false);
  });

  it("treats an equal result as not better for every type (no PR, no history entry)", () => {
    expect(isBetterPr("MAX_WEIGHT", 100, 100)).toBe(false);
    expect(isBetterPr("FASTEST_TIME", 120, 120)).toBe(false);
  });
});
