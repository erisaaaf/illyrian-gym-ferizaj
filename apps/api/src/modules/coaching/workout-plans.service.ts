import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationType, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { assertCanAccessClient, clientScope } from "../../common/client-access";
import { gymDateString } from "../../common/gym-time";
import { paginate, skipTake } from "../../common/pagination.util";
import { CreatePlanDto, ListPlansQueryDto, PlanItemDto, UpdatePlanDto } from "./dto/coaching.dto";

const DAY_MS = 86_400_000;

const PLAN_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
  items: { orderBy: [{ weekday: "asc" as const }, { position: "asc" as const }], include: { exercise: { select: { id: true, name: true, category: true, measurementType: true } } } },
} satisfies Prisma.WorkoutPlanInclude;

/** Plans are dated by calendar day, not instant: keep just the date part, as UTC midnight. */
const dateOnly = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);

/** ISO weekday (1 = Monday ... 7 = Sunday) of a `YYYY-MM-DD` calendar date. */
export function isoWeekday(dateString: string): number {
  const d = new Date(`${dateString}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday
  return d === 0 ? 7 : d;
}

/**
 * How closely the member followed the plan so far. A "planned day" is a calendar day (in the gym's timezone) inside the
 * plan's dates, not in the future, whose weekday has at least one exercise. It counts as done if the member logged any
 * workout that day. Pure and database-free so the rule is testable.
 */
export function computeAdherence(args: { weekdays: number[]; startsOn: string; endsOn?: string | null; today: string; trainedDays: Set<string> }) {
  const { weekdays, startsOn, endsOn, today, trainedDays } = args;
  const last = endsOn && endsOn < today ? endsOn : today;
  const planned: string[] = [];
  if (weekdays.length > 0 && startsOn <= last) {
    for (let d = new Date(`${startsOn}T00:00:00.000Z`); d.toISOString().slice(0, 10) <= last; d = new Date(d.getTime() + DAY_MS)) {
      const key = d.toISOString().slice(0, 10);
      if (weekdays.includes(isoWeekday(key))) planned.push(key);
    }
  }
  const completed = planned.filter((d) => trainedDays.has(d)).length;
  return { plannedDays: planned.length, completedDays: completed, percent: planned.length > 0 ? Math.round((completed / planned.length) * 100) : null };
}

@Injectable()
export class WorkoutPlansService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>("GYM_TIMEZONE")!;
  }

  // --- Trainer / owner ----------------------------------------------------------------------------

  async create(dto: CreatePlanDto, viewer: AuthenticatedUser) {
    await assertCanAccessClient(this.prisma, viewer, dto.userId);
    await this.assertExercises(dto.items);
    const startsOn = dateOnly(dto.startsOn);
    const endsOn = dto.endsOn ? dateOnly(dto.endsOn) : null;
    if (endsOn && endsOn < startsOn) throw new BadRequestException("The plan cannot end before it starts");

    const plan = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.workoutPlan.create({
        data: {
          userId: dto.userId,
          createdById: viewer.sub,
          title: dto.title,
          goal: dto.goal,
          notes: dto.notes,
          startsOn,
          endsOn,
          items: { create: this.itemRows(dto.items) },
        },
        include: PLAN_INCLUDE,
      });
      await tx.notification.create({
        data: { userId: dto.userId, type: NotificationType.MESSAGE, title: "New workout plan", body: `Your coach assigned you a plan: ${dto.title}.`, data: { planId: created.id } },
      });
      return created;
    });
    await this.audit.record({ actorId: viewer.sub, action: "workout_plan.create", entityType: "WorkoutPlan", entityId: plan.id, metadata: { userId: dto.userId } });
    return plan;
  }

  async list(query: ListPlansQueryDto, viewer: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = clientScope(viewer);
    const where: Prisma.WorkoutPlanWhereInput = {
      ...(scope ? { user: scope } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { user: { firstName: { contains: query.search, mode: "insensitive" } } }, { user: { lastName: { contains: query.search, mode: "insensitive" } } }] } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.workoutPlan.findMany({ where, include: PLAN_INCLUDE, orderBy: { createdAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.workoutPlan.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string, viewer: AuthenticatedUser) {
    const plan = await this.prisma.client.workoutPlan.findUnique({ where: { id }, include: PLAN_INCLUDE });
    if (!plan) throw new NotFoundException("Plan not found");
    await assertCanAccessClient(this.prisma, viewer, plan.userId);
    return { ...plan, adherence: await this.adherenceFor(plan) };
  }

  async update(id: string, dto: UpdatePlanDto, viewer: AuthenticatedUser) {
    const existing = await this.prisma.client.workoutPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Plan not found");
    await assertCanAccessClient(this.prisma, viewer, existing.userId);
    if (dto.items) await this.assertExercises(dto.items);

    const startsOn = dto.startsOn ? dateOnly(dto.startsOn) : existing.startsOn;
    const endsOn = dto.endsOn ? dateOnly(dto.endsOn) : existing.endsOn;
    if (endsOn && endsOn < startsOn) throw new BadRequestException("The plan cannot end before it starts");

    const plan = await this.prisma.client.$transaction(async (tx) => {
      if (dto.items) await tx.workoutPlanItem.deleteMany({ where: { planId: id } });
      return tx.workoutPlan.update({
        where: { id },
        data: {
          title: dto.title,
          goal: dto.goal,
          notes: dto.notes,
          startsOn,
          endsOn,
          status: dto.status,
          ...(dto.items ? { items: { create: this.itemRows(dto.items) } } : {}),
        },
        include: PLAN_INCLUDE,
      });
    });
    await this.audit.record({ actorId: viewer.sub, action: "workout_plan.update", entityType: "WorkoutPlan", entityId: id, metadata: { status: dto.status, itemsReplaced: Boolean(dto.items) } });
    return plan;
  }

  // --- The member's own -----------------------------------------------------------------------------

  /** The member's active plans, today's session pulled out, and how well they are following each plan. */
  async mine(userId: string) {
    const today = gymDateString(new Date(), this.tz);
    const weekday = isoWeekday(today);
    const plans = await this.prisma.client.workoutPlan.findMany({ where: { userId, status: "ACTIVE" }, include: PLAN_INCLUDE, orderBy: { startsOn: "desc" } });
    const result = [];
    for (const plan of plans) {
      const started = gymDateString(plan.startsOn, "UTC") <= today;
      const ended = plan.endsOn ? gymDateString(plan.endsOn, "UTC") < today : false;
      result.push({
        ...plan,
        isCurrent: started && !ended,
        todayItems: started && !ended ? plan.items.filter((i) => i.weekday === weekday) : [],
        adherence: await this.adherenceFor(plan),
      });
    }
    return { today, weekday, plans: result };
  }

  async adherenceFor(plan: { userId: string; startsOn: Date; endsOn: Date | null; items: Array<{ weekday: number }> }) {
    const today = gymDateString(new Date(), this.tz);
    const startsOn = gymDateString(plan.startsOn, "UTC");
    const endsOn = plan.endsOn ? gymDateString(plan.endsOn, "UTC") : null;
    const from = new Date(`${startsOn}T00:00:00.000Z`);
    const rows = await this.prisma.client.$queryRaw<Array<{ d: string }>>(Prisma.sql`
      SELECT DISTINCT to_char(date_trunc('day', "completedAt" AT TIME ZONE ${this.tz}), 'YYYY-MM-DD') AS d
      FROM "WorkoutResult" WHERE "userId" = ${plan.userId} AND "completedAt" >= ${new Date(from.getTime() - DAY_MS)}`);
    return computeAdherence({ weekdays: [...new Set(plan.items.map((i) => i.weekday))], startsOn, endsOn, today, trainedDays: new Set(rows.map((r) => r.d)) });
  }

  // --- helpers ---------------------------------------------------------------------------------------

  private itemRows(items: PlanItemDto[]) {
    return items.map((i, idx) => ({ weekday: i.weekday, position: i.position ?? idx, exerciseId: i.exerciseId, sets: i.sets, reps: i.reps, weightKg: i.weightKg, durationSeconds: i.durationSeconds, notes: i.notes }));
  }

  private async assertExercises(items: PlanItemDto[]) {
    const ids = [...new Set(items.map((i) => i.exerciseId))];
    if (ids.length === 0) return;
    const found = await this.prisma.client.exercise.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } });
    if (found.length !== ids.length) throw new BadRequestException("One or more exercises do not exist or are no longer available");
  }
}
