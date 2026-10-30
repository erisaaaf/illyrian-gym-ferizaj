import { Injectable, NotFoundException } from "@nestjs/common";
import { AttendanceStatus, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { assertCanManageClass } from "../../common/class-access";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ChallengesService } from "../challenges/challenges.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { ListAttendanceQueryDto } from "./dto/list-attendance.query.dto";

const ATTENDANCE_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  class: { select: { id: true, title: true, startTime: true } },
  markedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly challenges: ChallengesService,
  ) {}

  async listMine(userId: string, query: Pick<ListAttendanceQueryDto, "page" | "pageSize">) {
    return this.query({ ...query, userId });
  }

  /** Staff view. Trainers only ever see attendance for their own classes. */
  async list(query: ListAttendanceQueryDto, user: AuthenticatedUser) {
    return this.query(query, user.role === "COACH" ? user.sub : undefined);
  }

  private async query(query: ListAttendanceQueryDto, onlyCoachUserId?: string) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const classFilter: Prisma.ClassWhereInput = {
      ...(onlyCoachUserId ? { coach: { userId: onlyCoachUserId } } : {}),
      ...(query.from || query.to
        ? {
            startTime: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const where: Prisma.AttendanceWhereInput = {
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(Object.keys(classFilter).length > 0 ? { class: classFilter } : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.attendance.findMany({
        where,
        include: ATTENDANCE_INCLUDE,
        orderBy: { class: { startTime: "desc" } },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.attendance.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }

  /**
   * Upsert-style mark/correct - one attendance row per (user, class). Records who
   * made the change on the row itself and in the audit log (with the previous
   * status), so a correction never silently erases what was there before.
   */
  async mark(dto: MarkAttendanceDto, user: AuthenticatedUser) {
    const cls = await assertCanManageClass(this.prisma, dto.classId, user);
    const member = await this.prisma.client.user.findUnique({ where: { id: dto.userId } });
    if (!member) throw new NotFoundException("Member not found");

    const status = (dto.status ?? "CHECKED_IN") as AttendanceStatus;
    const now = new Date();
    const [booking, previous] = await Promise.all([
      this.prisma.client.booking.findFirst({
        where: { userId: dto.userId, classId: dto.classId, status: { in: ["BOOKED", "ATTENDED", "NO_SHOW"] } },
      }),
      this.prisma.client.attendance.findUnique({ where: { userId_classId: { userId: dto.userId, classId: dto.classId } } }),
    ]);

    const attendance = await this.prisma.client.attendance.upsert({
      where: { userId_classId: { userId: dto.userId, classId: dto.classId } },
      create: {
        userId: dto.userId,
        classId: dto.classId,
        bookingId: booking?.id,
        status,
        checkedInAt: status === "CHECKED_IN" ? now : null,
        markedById: user.sub,
        markedAt: now,
      },
      update: {
        status,
        checkedInAt: status === "CHECKED_IN" ? (previous?.checkedInAt ?? now) : null,
        markedById: user.sub,
        markedAt: now,
      },
      include: ATTENDANCE_INCLUDE,
    });

    if (booking) {
      // Keep the booking in step with attendance in every direction, so a correction can always be undone.
      const bookingStatus = status === "CHECKED_IN" ? "ATTENDED" : status === "NO_SHOW" ? "NO_SHOW" : "BOOKED";
      if (booking.status !== bookingStatus) {
        await this.prisma.client.booking.update({ where: { id: booking.id }, data: { status: bookingStatus } });
      }
    }

    // One point per class actually attended (not for repeat saves or corrections that keep it checked in).
    if (status === "CHECKED_IN" && previous?.status !== "CHECKED_IN") {
      await this.challenges.awardParticipation(dto.userId, cls.startTime);
    }

    await this.audit.record({
      actorId: user.sub,
      action: previous ? "attendance.correct" : "attendance.mark",
      entityType: "Attendance",
      entityId: attendance.id,
      metadata: { userId: dto.userId, classId: dto.classId, status, previousStatus: previous?.status ?? null },
    });

    return attendance;
  }
}
