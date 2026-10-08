import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ClassStatus, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { ListClassesQueryDto } from "./dto/list-classes.query.dto";

const CLASS_INCLUDE = {
  coach: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
} as const;

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListClassesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ClassWhereInput = {
      ...(query.coachId ? { coachId: query.coachId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startTime: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.class.findMany({
        where,
        include: CLASS_INCLUDE,
        orderBy: { startTime: "asc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.class.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string) {
    const cls = await this.prisma.client.class.findUnique({ where: { id }, include: CLASS_INCLUDE });
    if (!cls) throw new NotFoundException("Class not found");
    return cls;
  }

  async participants(id: string) {
    const cls = await this.prisma.client.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException("Class not found");

    return this.prisma.client.booking.findMany({
      where: { classId: id, status: { in: ["BOOKED", "WAITLISTED", "ATTENDED", "NO_SHOW"] } },
      orderBy: { bookedAt: "asc" },
      select: {
        id: true,
        status: true,
        bookedAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async create(dto: CreateClassDto, actorId: string) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) throw new BadRequestException("endTime must be after startTime");

    if (dto.coachId) await this.assertCoachExists(dto.coachId);

    const cls = await this.prisma.client.class.create({
      data: {
        title: dto.title,
        description: dto.description,
        coachId: dto.coachId,
        startTime,
        endTime,
        capacity: dto.capacity,
      },
      include: CLASS_INCLUDE,
    });

    await this.audit.record({ actorId, action: "class.create", entityType: "Class", entityId: cls.id });
    return cls;
  }

  async update(id: string, dto: UpdateClassDto, actorId: string) {
    const existing = await this.prisma.client.class.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Class not found");

    if (dto.coachId) await this.assertCoachExists(dto.coachId);

    const startTime = dto.startTime ? new Date(dto.startTime) : existing.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;
    if (endTime <= startTime) throw new BadRequestException("endTime must be after startTime");

    if (dto.capacity !== undefined && dto.capacity < existing.bookedCount) {
      throw new BadRequestException(
        `Capacity cannot be set below the current number of bookings (${existing.bookedCount})`,
      );
    }

    const cls = await this.prisma.client.class.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        coachId: dto.coachId,
        startTime,
        endTime,
        capacity: dto.capacity,
        status: dto.status,
      },
      include: CLASS_INCLUDE,
    });

    await this.audit.record({ actorId, action: "class.update", entityType: "Class", entityId: id });
    return cls;
  }

  async cancel(id: string, actorId: string) {
    const existing = await this.prisma.client.class.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Class not found");

    const cls = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.class.update({
        where: { id },
        data: { status: ClassStatus.CANCELLED },
        include: CLASS_INCLUDE,
      });
      await tx.booking.updateMany({
        where: { classId: id, status: { in: ["BOOKED", "WAITLISTED"] } },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      return updated;
    });

    await this.audit.record({ actorId, action: "class.cancel", entityType: "Class", entityId: id });
    return cls;
  }

  private async assertCoachExists(coachId: string) {
    const coach = await this.prisma.client.coach.findUnique({ where: { id: coachId } });
    if (!coach) throw new BadRequestException("Coach not found");
  }
}
