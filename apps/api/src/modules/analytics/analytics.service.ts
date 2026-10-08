import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const THIRTY_DAYS_MS = 30 * 86_400_000;
const SEVEN_DAYS_MS = 7 * 86_400_000;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every field here is a real query result - no hard-coded numbers (spec section 21). */
  async overview() {
    const db = this.prisma.client;
    const now = new Date();
    const soon = new Date(now.getTime() + SEVEN_DAYS_MS);
    const last30 = new Date(now.getTime() - THIRTY_DAYS_MS);

    const [
      totalMembers,
      activeMembers,
      membershipsExpiringSoon,
      membershipsExpired,
      upcomingClasses,
      classCapacityAgg,
      attendanceLast30Days,
      workoutsLast30Days,
      newPrsLast30Days,
      activeChallenges,
      challengeParticipants,
      unreadNotifications,
    ] = await Promise.all([
      db.user.count({ where: { role: "MEMBER" } }),
      db.user.count({ where: { role: "MEMBER", status: "ACTIVE" } }),
      db.membership.count({ where: { status: "ACTIVE", endDate: { gte: now, lte: soon } } }),
      db.membership.count({ where: { status: "ACTIVE", endDate: { lt: now } } }),
      db.class.count({ where: { status: "SCHEDULED", startTime: { gte: now, lte: soon } } }),
      db.class.aggregate({
        where: { status: "SCHEDULED", startTime: { gte: now, lte: soon } },
        _sum: { bookedCount: true, capacity: true },
      }),
      db.attendance.count({ where: { status: "CHECKED_IN", createdAt: { gte: last30 } } }),
      db.workoutResult.count({ where: { completedAt: { gte: last30 } } }),
      db.personalRecordHistory.count({ where: { source: "AUTO_DETECTED", createdAt: { gte: last30 } } }),
      db.challenge.count({ where: { status: "ACTIVE" } }),
      db.challengeParticipant.count({ where: { challenge: { status: "ACTIVE" } } }),
      db.notification.count({ where: { readAt: null } }),
    ]);

    const bookedSum = classCapacityAgg._sum.bookedCount ?? 0;
    const capacitySum = classCapacityAgg._sum.capacity ?? 0;

    return {
      generatedAt: now.toISOString(),
      members: { total: totalMembers, active: activeMembers },
      memberships: { expiringSoon: membershipsExpiringSoon, expired: membershipsExpired },
      classes: { upcoming: upcomingClasses },
      bookings: {
        utilizationPercent: capacitySum > 0 ? Math.round((bookedSum / capacitySum) * 100) : null,
        bookedSpots: bookedSum,
        totalCapacity: capacitySum,
      },
      training: {
        attendanceLast30Days,
        workoutsLast30Days,
        newPrsLast30Days,
      },
      challenges: { active: activeChallenges, participants: challengeParticipants },
      notifications: { unread: unreadNotifications },
    };
  }
}
