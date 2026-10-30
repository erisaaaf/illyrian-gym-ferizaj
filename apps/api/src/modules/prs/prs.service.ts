import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { assertCanAccessClient, clientScope } from "../../common/client-access";
import { randomUUID } from "crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrType, PrUnit, VerificationStatus } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { extractPrCandidate, isBetterPr, WorkoutResultLike } from "./pr-engine";
import { ManualPrDto } from "./dto/manual-pr.dto";
import { CorrectPrDto } from "./dto/correct-pr.dto";
import { ListPrsQueryDto } from "./dto/list-prs.query.dto";

type Tx = Prisma.TransactionClient;

export interface ApplyResult {
  isNewPr: boolean;
  personalRecord: { id: string; value: Prisma.Decimal; unit: PrUnit } | null;
  previousValue: number | null;
}

const PR_INCLUDE = {
  exercise: { select: { id: true, name: true, category: true, prType: true } },
  user: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class PrsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The PR engine's only entry point from workout submission. Concurrency
   * safety comes from an `INSERT ... ON CONFLICT DO NOTHING` (races the
   * first PR into existence exactly once) followed by `SELECT ... FOR
   * UPDATE` (serializes concurrent "is this better?" comparisons on the
   * same row) rather than a plain read-compare-write - see
   * docs/database.md#pr-concurrency. Must be called inside an existing
   * transaction so it shares atomicity with the WorkoutResult insert.
   */
  async applyWorkoutResult(
    tx: Tx,
    params: { userId: string; exerciseId: string; prType: PrType; workoutResultId: string; achievedAt: Date; result: WorkoutResultLike },
  ): Promise<ApplyResult> {
    const candidate = extractPrCandidate(params.prType, params.result);
    if (!candidate) return { isNewPr: false, personalRecord: null, previousValue: null };

    const newId = randomUUID();
    const inserted = await tx.$queryRaw<Array<{ id: string; value: Prisma.Decimal; unit: PrUnit }>>`
      INSERT INTO "PersonalRecord"
        ("id","userId","exerciseId","recordType","value","unit","achievedAt","sourceWorkoutId","verificationStatus","createdAt","updatedAt")
      VALUES
        (${newId}, ${params.userId}, ${params.exerciseId}, ${params.prType}::"PrType", ${candidate.value}, ${candidate.unit}::"PrUnit", ${params.achievedAt}, ${params.workoutResultId}, 'UNVERIFIED', now(), now())
      ON CONFLICT ("userId", "exerciseId") DO NOTHING
      RETURNING id, value, unit
    `;

    if (inserted.length === 1) {
      const pr = inserted[0];
      await tx.personalRecordHistory.create({
        data: {
          personalRecordId: pr.id,
          userId: params.userId,
          exerciseId: params.exerciseId,
          previousValue: null,
          newValue: candidate.value,
          unit: candidate.unit,
          achievedAt: params.achievedAt,
          sourceWorkoutId: params.workoutResultId,
          source: "AUTO_DETECTED",
        },
      });
      return { isNewPr: true, personalRecord: pr, previousValue: null };
    }

    const [locked] = await tx.$queryRaw<Array<{ id: string; value: Prisma.Decimal; unit: PrUnit }>>`
      SELECT id, value, unit FROM "PersonalRecord"
      WHERE "userId" = ${params.userId} AND "exerciseId" = ${params.exerciseId}
      FOR UPDATE
    `;

    const currentValue = Number(locked.value);
    if (!isBetterPr(params.prType, candidate.value, currentValue)) {
      return { isNewPr: false, personalRecord: locked, previousValue: currentValue };
    }

    const updated = await tx.personalRecord.update({
      where: { id: locked.id },
      data: {
        value: candidate.value,
        unit: candidate.unit,
        achievedAt: params.achievedAt,
        sourceWorkoutId: params.workoutResultId,
        verificationStatus: "UNVERIFIED",
        verifiedById: null,
        verifiedAt: null,
      },
    });

    await tx.personalRecordHistory.create({
      data: {
        personalRecordId: updated.id,
        userId: params.userId,
        exerciseId: params.exerciseId,
        previousValue: currentValue,
        newValue: candidate.value,
        unit: candidate.unit,
        achievedAt: params.achievedAt,
        sourceWorkoutId: params.workoutResultId,
        source: "AUTO_DETECTED",
      },
    });

    return { isNewPr: true, personalRecord: updated, previousValue: currentValue };
  }

  async listMine(userId: string) {
    return this.prisma.client.personalRecord.findMany({
      where: { userId },
      include: PR_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
  }

  async historyMine(userId: string, exerciseId: string) {
    return this.prisma.client.personalRecordHistory.findMany({
      where: { userId, exerciseId },
      orderBy: { achievedAt: "asc" },
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async list(query: ListPrsQueryDto, viewer: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = clientScope(viewer); // trainers only ever see their own clients' records
    const where: Prisma.PersonalRecordWhereInput = {
      ...(scope ? { user: scope } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.exerciseId ? { exerciseId: query.exerciseId } : {}),
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { user: { firstName: { contains: query.search, mode: "insensitive" } } },
              { user: { lastName: { contains: query.search, mode: "insensitive" } } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
              { exercise: { name: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.personalRecord.findMany({
        where,
        include: PR_INCLUDE,
        orderBy: { updatedAt: "desc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.personalRecord.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async history(id: string, viewer: AuthenticatedUser) {
    const pr = await this.prisma.client.personalRecord.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException("Personal record not found");
    await assertCanAccessClient(this.prisma, viewer, pr.userId);
    return this.prisma.client.personalRecordHistory.findMany({
      where: { personalRecordId: id },
      orderBy: { achievedAt: "asc" },
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async verify(id: string, viewer: AuthenticatedUser) {
    const actorId = viewer.sub;
    const pr = await this.prisma.client.personalRecord.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException("Personal record not found");
    await assertCanAccessClient(this.prisma, viewer, pr.userId);

    const updated = await this.prisma.client.personalRecord.update({
      where: { id },
      data: { verificationStatus: VerificationStatus.VERIFIED, verifiedById: actorId, verifiedAt: new Date() },
      include: PR_INCLUDE,
    });

    await this.audit.record({ actorId, action: "pr.verify", entityType: "PersonalRecord", entityId: id });
    return updated;
  }

  /** Explicit staff override of the current value - always applied, logged with source=CORRECTED. */
  async correct(id: string, dto: CorrectPrDto, viewer: AuthenticatedUser) {
    const actorId = viewer.sub;
    const pr = await this.prisma.client.personalRecord.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException("Personal record not found");
    await assertCanAccessClient(this.prisma, viewer, pr.userId);

    const previousValue = Number(pr.value);
    const achievedAt = new Date(dto.achievedAt);

    const [updated] = await this.prisma.client.$transaction([
      this.prisma.client.personalRecord.update({
        where: { id },
        data: { value: dto.value, achievedAt, verificationStatus: VerificationStatus.VERIFIED, verifiedById: actorId, verifiedAt: new Date() },
        include: PR_INCLUDE,
      }),
      this.prisma.client.personalRecordHistory.create({
        data: {
          personalRecordId: id,
          userId: pr.userId,
          exerciseId: pr.exerciseId,
          previousValue,
          newValue: dto.value,
          unit: pr.unit,
          achievedAt,
          source: "CORRECTED",
          recordedById: actorId,
        },
      }),
    ]);

    await this.audit.record({
      actorId,
      action: "pr.correct",
      entityType: "PersonalRecord",
      entityId: id,
      metadata: { previousValue, newValue: dto.value, reason: dto.reason },
    });

    return updated;
  }

  /** Staff entering a PR that has no digital history yet - only allowed when none exists. */
  async manualAdd(dto: ManualPrDto, viewer: AuthenticatedUser) {
    const actorId = viewer.sub;
    await assertCanAccessClient(this.prisma, viewer, dto.userId);
    const [user, exercise] = await Promise.all([
      this.prisma.client.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.client.exercise.findUnique({ where: { id: dto.exerciseId } }),
    ]);
    if (!user) throw new NotFoundException("Member not found");
    if (!exercise) throw new NotFoundException("Exercise not found");
    if (!exercise.prType) throw new BadRequestException("This exercise does not track personal records");

    const existing = await this.prisma.client.personalRecord.findUnique({
      where: { userId_exerciseId: { userId: dto.userId, exerciseId: dto.exerciseId } },
    });
    if (existing) {
      throw new ConflictException("A personal record already exists for this member/exercise - use correct instead");
    }

    const unit = defaultUnitFor(exercise.prType);
    const achievedAt = new Date(dto.achievedAt);

    const [pr] = await this.prisma.client.$transaction([
      this.prisma.client.personalRecord.create({
        data: {
          userId: dto.userId,
          exerciseId: dto.exerciseId,
          recordType: exercise.prType,
          value: dto.value,
          unit,
          achievedAt,
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedById: actorId,
          verifiedAt: new Date(),
        },
        include: PR_INCLUDE,
      }),
    ]);

    await this.prisma.client.personalRecordHistory.create({
      data: {
        personalRecordId: pr.id,
        userId: dto.userId,
        exerciseId: dto.exerciseId,
        previousValue: null,
        newValue: dto.value,
        unit,
        achievedAt,
        source: "MANUAL",
        recordedById: actorId,
      },
    });

    await this.audit.record({
      actorId,
      action: "pr.manual_add",
      entityType: "PersonalRecord",
      entityId: pr.id,
      metadata: { userId: dto.userId, exerciseId: dto.exerciseId, value: dto.value, reason: dto.reason },
    });

    return pr;
  }
}

function defaultUnitFor(prType: PrType): PrUnit {
  switch (prType) {
    case "MAX_WEIGHT":
      return "KG";
    case "MAX_REPS":
      return "REPS";
    case "FASTEST_TIME":
      return "SECONDS";
    case "MAX_DISTANCE":
      return "KM";
    case "MAX_ROUNDS":
      return "ROUNDS";
  }
}
