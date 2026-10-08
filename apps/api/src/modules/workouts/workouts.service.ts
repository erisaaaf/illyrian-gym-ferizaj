import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { PrsService } from "../prs/prs.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { RecordWorkoutDto } from "./dto/record-workout.dto";

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prsService: PrsService,
  ) {}

  async record(userId: string, dto: RecordWorkoutDto) {
    if (!dto.wodId && !dto.exerciseId) {
      throw new BadRequestException("A workout must reference a WOD and/or an exercise");
    }
    if (dto.wodId) {
      const wod = await this.prisma.client.wod.findUnique({ where: { id: dto.wodId } });
      if (!wod) throw new NotFoundException("WOD not found");
    }

    let exercise = null;
    if (dto.exerciseId) {
      exercise = await this.prisma.client.exercise.findUnique({ where: { id: dto.exerciseId } });
      if (!exercise) throw new NotFoundException("Exercise not found");
    }

    const completedAt = dto.completedAt ? new Date(dto.completedAt) : new Date();

    const result = await this.prisma.client.$transaction(async (tx) => {
      const workoutResult = await tx.workoutResult.create({
        data: {
          userId,
          wodId: dto.wodId,
          exerciseId: dto.exerciseId,
          sets: dto.sets,
          reps: dto.reps,
          weightKg: dto.weightKg,
          durationSeconds: dto.durationSeconds,
          distanceMeters: dto.distanceMeters,
          rounds: dto.rounds,
          calories: dto.calories,
          notes: dto.notes,
          completedAt,
        },
      });

      let prOutcome = null;
      if (exercise?.prType) {
        prOutcome = await this.prsService.applyWorkoutResult(tx, {
          userId,
          exerciseId: exercise.id,
          prType: exercise.prType,
          workoutResultId: workoutResult.id,
          achievedAt: completedAt,
          result: workoutResult,
        });

        if (prOutcome.isNewPr) {
          await tx.notification.create({
            data: {
              userId,
              type: NotificationType.NEW_PR,
              title: "New PR!",
              body: `You set a new personal record on ${exercise.name}.`,
              data: { exerciseId: exercise.id, personalRecordId: prOutcome.personalRecord?.id },
            },
          });
        }
      }

      return { workoutResult, prOutcome };
    });

    return result;
  }

  async listMine(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = { userId };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.workoutResult.findMany({
        where,
        orderBy: { completedAt: "desc" },
        include: { wod: { select: { id: true, title: true } }, exercise: { select: { id: true, name: true } } },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.workoutResult.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }
}
