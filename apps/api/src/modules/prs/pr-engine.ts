import { PrType, PrUnit } from "@illyrian/database";

export interface WorkoutResultLike {
  weightKg: unknown;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: unknown;
  rounds: number | null;
}

export interface PrCandidate {
  value: number;
  unit: PrUnit;
}

/**
 * Pulls the value relevant to a given PrType out of a workout result. A
 * submission that doesn't include the field the exercise tracks (e.g. a
 * FASTEST_TIME exercise logged with only reps) simply isn't PR-eligible -
 * returns null rather than guessing.
 */
export function extractPrCandidate(prType: PrType, result: WorkoutResultLike): PrCandidate | null {
  switch (prType) {
    case "MAX_WEIGHT":
      return result.weightKg != null ? { value: Number(result.weightKg), unit: "KG" } : null;
    case "MAX_REPS":
      return result.reps != null ? { value: result.reps, unit: "REPS" } : null;
    case "FASTEST_TIME":
      return result.durationSeconds != null ? { value: result.durationSeconds, unit: "SECONDS" } : null;
    case "MAX_DISTANCE":
      // Stored in meters on WorkoutResult; PRs are tracked in km.
      return result.distanceMeters != null ? { value: Number(result.distanceMeters) / 1000, unit: "KM" } : null;
    case "MAX_ROUNDS":
      return result.rounds != null ? { value: result.rounds, unit: "ROUNDS" } : null;
    default:
      return null;
  }
}

/** FASTEST_TIME is lower-is-better; every other PrType is higher-is-better - spec section 23. */
export function isBetterPr(prType: PrType, candidate: number, current: number): boolean {
  if (prType === "FASTEST_TIME") return candidate < current;
  return candidate > current;
}
