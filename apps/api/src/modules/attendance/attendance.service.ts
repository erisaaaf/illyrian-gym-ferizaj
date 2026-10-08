import { Injectable, NotFoundException } from "@nestjs/common";
import { AttendanceStatus, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { ListAttendanceQueryDto } from "./dto/list-attendance.query.dto";

const ATTENDANCE_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  class: { select: { id: true, title: true, startTime: true } },
} as const;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listMine(userId: string, query: Pick<ListAttendanceQueryDto, "page" | "pageSize">) {
    return this.list({ ...query, userId });
  }

  async list(query: ListAttendanceQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AttendanceWhereInput = {
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            class: {
              startTime: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.attendance.findMany({
        where,
        include: ATTENDANCE_INCLUDE,
        orderBy: { createdAt: "desc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.attendance.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }

  /** Upsert-style mark/correct - one attendance row per (user, class), records who last changed it via the audit log. */
  async mark(dto: MarkAttendanceDto, actorId: string) {
    const [user, cls] = await Promise.all([
      this.prisma.client.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.client.class.findUnique({ where: { id: dto.classId } }),
    ]);
    if (!user) throw new NotFoundException("Member not found");
    if (!cls) throw new NotFoundException("Class not found");

    const status = (dto.status ?? "CHECKED_IN") as AttendanceStatus;
    const booking = await this.prisma.client.booking.findFirst({
      where: { userId: dto.userId, classId: dto.classId, status: { in: ["BOOKED", "ATTENDED"] } },
    });

    const attendance = await this.prisma.client.attendance.upsert({
      where: { userId_classId: { userId: dto.userId, classId: dto.classId } },
      create: {
        userId: dto.userId,
        classId: dto.classId,
        bookingId: booking?.id,
        status,
        checkedInAt: status === "CHECKED_IN" ? new Date() : null,
      },
      update: {
        status,
        checkedInAt: status === "CHECKED_IN" ? new Date() : null,
      },
      include: ATTENDANCE_INCLUDE,
    });

    if (booking && status === "CHECKED_IN") {
      await this.prisma.client.booking.update({ where: { id: booking.id }, data: { status: "ATTENDED" } });
    }

    await this.audit.record({
      actorId,
      action: "attendance.mark",
      entityType: "Attendance",
      entityId: attendance.id,
      metadata: { userId: dto.userId, classId: dto.classId, status },
    });

    return attendance;
  }
}
