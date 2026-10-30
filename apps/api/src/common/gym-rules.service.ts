import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Operating rules the gym can change in Settings. Defaults are starting points to confirm with the gym. */
export interface GymRules {
  expiringSoonDays: number;
  atRiskShortDays: number;
  atRiskLongDays: number;
  duplicateScanMinutes: number;
  blockUnpaidCheckIn: boolean;
  /** null = no limit has been configured (the freeze policy has not been confirmed). */
  maxFreezeDays: number | null;
  invoiceDueDays: number;
}

export const DEFAULT_RULES: GymRules = {
  expiringSoonDays: 7,
  atRiskShortDays: 14,
  atRiskLongDays: 30,
  duplicateScanMinutes: 10,
  blockUnpaidCheckIn: false,
  maxFreezeDays: null,
  invoiceDueDays: 0,
};

const CACHE_MS = 15_000;

/** Reads the gym's operating rules, cached briefly so hot paths (check-in, listings) do not hit the DB every time. */
@Injectable()
export class GymRulesService {
  private cached: { at: number; rules: GymRules } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<GymRules> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.rules;
    const row = await this.prisma.client.gymSettings.findUnique({ where: { id: "default" } });
    const rules: GymRules = row
      ? {
          expiringSoonDays: row.expiringSoonDays,
          atRiskShortDays: row.atRiskShortDays,
          atRiskLongDays: row.atRiskLongDays,
          duplicateScanMinutes: row.duplicateScanMinutes,
          blockUnpaidCheckIn: row.blockUnpaidCheckIn,
          maxFreezeDays: row.maxFreezeDays,
          invoiceDueDays: row.invoiceDueDays,
        }
      : DEFAULT_RULES;
    this.cached = { at: Date.now(), rules };
    return rules;
  }

  /** Call after the settings change so the new rules apply immediately. */
  invalidate() {
    this.cached = null;
  }
}
