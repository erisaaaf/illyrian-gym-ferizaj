import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { CreateExerciseDto } from "./dto/create-exercise.dto";
import { UpdateExerciseDto } from "./dto/update-exercise.dto";
import { ListExercisesQueryDto } from "./dto/list-exercises.query.dto";

@Injectable()
export class ExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Members only ever see the active catalog; staff can browse and filter by active state. */
  async list(query: ListExercisesQueryDto, isStaff: boolean) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.ExerciseWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(!isStaff ? { active: true } : query.active !== undefined ? { active: query.active === "true" } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.exercise.findMany({ where, orderBy: { name: "asc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.exercise.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string) {
    const exercise = await this.prisma.client.exercise.findUnique({ where: { id } });
    if (!exercise) throw new NotFoundException("Exercise not found");
    return exercise;
  }

  async create(dto: CreateExerciseDto, actorId: string) {
    const existing = await this.prisma.client.exercise.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException("An exercise with this name already exists");

    const exercise = await this.prisma.client.exercise.create({
      data: { ...dto, equipment: dto.equipment ?? [] },
    });
    await this.audit.record({ actorId, action: "exercise.create", entityType: "Exercise", entityId: exercise.id });
    return exercise;
  }

  async update(id: string, dto: UpdateExerciseDto, actorId: string) {
    const existing = await this.prisma.client.exercise.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Exercise not found");

    const exercise = await this.prisma.client.exercise.update({ where: { id }, data: dto });
    await this.audit.record({ actorId, action: "exercise.update", entityType: "Exercise", entityId: id });
    return exercise;
  }

  async setActive(id: string, active: boolean, actorId: string) {
    const existing = await this.prisma.client.exercise.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Exercise not found");

    const exercise = await this.prisma.client.exercise.update({ where: { id }, data: { active } });
    await this.audit.record({
      actorId,
      action: active ? "exercise.reactivate" : "exercise.deactivate",
      entityType: "Exercise",
      entityId: id,
    });
    return exercise;
  }
}
