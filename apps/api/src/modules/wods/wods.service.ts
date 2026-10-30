import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, WodStatus } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { gymTodayDate } from "../../common/gym-time";
import { CreateWodDto } from "./dto/create-wod.dto";
import { UpdateWodDto } from "./dto/update-wod.dto";
import { ListWodsQueryDto } from "./dto/list-wods.query.dto";

const WOD_INCLUDE = {
  sections: {
    orderBy: { order: "asc" as const },
    include: {
      exercises: {
        orderBy: { order: "asc" as const },
        include: { exercise: { select: { id: true, name: true, category: true, measurementType: true } } },
      },
    },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.WodInclude;

@Injectable()
export class WodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListWodsQueryDto, isStaff: boolean) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.WodWhereInput = {
      // Members only ever see published WODs, regardless of what they ask for.
      status: isStaff ? query.status : WodStatus.PUBLISHED,
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.from || query.to
        ? { date: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.wod.findMany({ where, include: WOD_INCLUDE, orderBy: { date: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.wod.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }

  async today(isStaff: boolean) {
    return this.prisma.client.wod.findFirst({
      where: {
        date: gymTodayDate(this.config.get<string>("GYM_TIMEZONE")),
        // Members only ever see a published WOD; staff also see a draft for today.
        ...(isStaff ? { status: { not: WodStatus.ARCHIVED } } : { status: WodStatus.PUBLISHED }),
      },
      include: WOD_INCLUDE,
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    });
  }

  async findOne(id: string, isStaff: boolean) {
    const wod = await this.prisma.client.wod.findUnique({ where: { id }, include: WOD_INCLUDE });
    if (!wod) throw new NotFoundException("WOD not found");
    if (!isStaff && wod.status !== WodStatus.PUBLISHED) throw new NotFoundException("WOD not found");
    return wod;
  }

  async create(dto: CreateWodDto, actorId: string) {
    const wod = await this.prisma.client.wod.create({
      data: {
        title: dto.title,
        date: new Date(dto.date),
        type: dto.type,
        description: dto.description,
        createdById: actorId,
        sections: {
          create: dto.sections.map((section) => ({
            type: section.type,
            order: section.order,
            notes: section.notes,
            exercises: {
              create: section.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                order: ex.order,
                sets: ex.sets,
                reps: ex.reps,
                weightKg: ex.weightKg,
                durationSeconds: ex.durationSeconds,
                restSeconds: ex.restSeconds,
                rounds: ex.rounds,
                timeCapSeconds: ex.timeCapSeconds,
                instructions: ex.instructions,
                scalingNotes: ex.scalingNotes,
              })),
            },
          })),
        },
      },
      include: WOD_INCLUDE,
    });

    await this.audit.record({ actorId, action: "wod.create", entityType: "Wod", entityId: wod.id });
    return wod;
  }

  async update(id: string, dto: UpdateWodDto, actorId: string) {
    const existing = await this.prisma.client.wod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("WOD not found");

    const wod = await this.prisma.client.$transaction(async (tx) => {
      if (dto.sections) {
        // Nested editable form - simplest correct approach is replace all
        // sections/exercises rather than diffing, since a WOD's own
        // sections have no independent identity the client tracks.
        await tx.wodSection.deleteMany({ where: { wodId: id } });
      }

      return tx.wod.update({
        where: { id },
        data: {
          title: dto.title,
          date: dto.date ? new Date(dto.date) : undefined,
          type: dto.type,
          description: dto.description,
          status: dto.status,
          ...(dto.sections
            ? {
                sections: {
                  create: dto.sections.map((section) => ({
                    type: section.type,
                    order: section.order,
                    notes: section.notes,
                    exercises: {
                      create: section.exercises.map((ex) => ({
                        exerciseId: ex.exerciseId,
                        order: ex.order,
                        sets: ex.sets,
                        reps: ex.reps,
                        weightKg: ex.weightKg,
                        durationSeconds: ex.durationSeconds,
                        restSeconds: ex.restSeconds,
                        rounds: ex.rounds,
                        timeCapSeconds: ex.timeCapSeconds,
                        instructions: ex.instructions,
                        scalingNotes: ex.scalingNotes,
                      })),
                    },
                  })),
                },
              }
            : {}),
        },
        include: WOD_INCLUDE,
      });
    });

    await this.audit.record({ actorId, action: "wod.update", entityType: "Wod", entityId: id });
    return wod;
  }

  async setStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", actorId: string) {
    const existing = await this.prisma.client.wod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("WOD not found");

    const wod = await this.prisma.client.wod.update({ where: { id }, data: { status }, include: WOD_INCLUDE });
    await this.audit.record({ actorId, action: `wod.${status.toLowerCase()}`, entityType: "Wod", entityId: id });
    return wod;
  }
}
