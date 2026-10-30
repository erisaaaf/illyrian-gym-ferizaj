import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { currentStreakDays, gymDateString } from "../../common/gym-time";

const DAY_MS = 86_400_000;
const WEEKS = 4;

/** Training-performance summary for one member. Everything is computed from stored records. */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async summary(userId: string) {
    const tz = this.config.get<string>("GYM_TIMEZONE")!;
    const db = this.prisma.client;
    const now = new Date();
    const since = new Date(now.getTime() - 120 * DAY_MS);

    const [workoutsCompleted, classesAttended, prCount, recentPrs, workouts, checkIns] = await Promise.all([
      db.workoutResult.count({ where: { userId } }),
      db.attendance.count({ where: { userId, status: "CHECKED_IN" } }),
      db.personalRecord.count({ where: { userId } }),
      db.personalRecord.findMany({
        where: { userId },
        orderBy: { achievedAt: "desc" },
        take: 5,
        select: { id: true, value: true, unit: true, achievedAt: true, verificationStatus: true, exercise: { select: { id: true, name: true } } },
      }),
      db.workoutResult.findMany({ where: { userId, completedAt: { gte: since } }, select: { completedAt: true } }),
      db.attendance.findMany({ where: { userId, status: "CHECKED_IN", checkedInAt: { gte: since } }, select: { checkedInAt: true } }),
    ]);

    // A "training day" is any day with at least one logged workout or class check-in.
    const activityDays = new Set<string>();
    for (const w of workouts) activityDays.add(gymDateString(w.completedAt, tz));
    for (const c of checkIns) if (c.checkedInAt) activityDays.add(gymDateString(c.checkedInAt, tz));

    const today = gymDateString(now, tz);
    const weeklyTrainingDays = Array.from({ length: WEEKS }, (_, i) => {
      // i = 0 is the most recent 7 days, counted back from today.
      let days = 0;
      for (let d = 0; d < 7; d++) {
        if (activityDays.has(gymDateString(new Date(now.getTime() - (i * 7 + d) * DAY_MS), tz))) days++;
      }
      return { weeksAgo: i, trainingDays: days };
    });

    const last30Cutoff = gymDateString(new Date(now.getTime() - 29 * DAY_MS), tz);
    const trainingDaysLast30 = [...activityDays].filter((d) => d >= last30Cutoff).length;

    return {
      workoutsCompleted,
      classesAttended,
      prCount,
      recentPrs,
      currentStreakDays: currentStreakDays(activityDays, today),
      trainingDaysLast30,
      weeklyTrainingDays,
    };
  }
}
