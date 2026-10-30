import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { assertCanAccessClient, clientScope } from "../../common/client-access";
import { GymRulesService } from "../../common/gym-rules.service";
import { pickCurrentMembership } from "../../common/current-membership";
import { gymPeriodStart } from "../../common/gym-time";
import { computeMembershipStatus, daysRemaining } from "../../common/membership-status.util";
import { paginate, skipTake } from "../../common/pagination.util";
import { ProgressService } from "../progress/progress.service";
import { WorkoutPlansService } from "./workout-plans.service";
import { ClientReportQueryDto, ListClientsQueryDto } from "./dto/coaching.dto";

const DAY_MS = 86_400_000;

/**
 * The trainer portal's view of a client. What a trainer sees is deliberately limited to coaching data: no payments,
 * invoices or balances, no contact details beyond the name, and private body data only if the member shared it.
 */
@Injectable()
export class ClientsService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: GymRulesService,
    private readonly progress: ProgressService,
    private readonly plans: WorkoutPlansService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>("GYM_TIMEZONE")!;
  }

  async list(query: ListClientsQueryDto, viewer: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = clientScope(viewer);
    const where: Prisma.UserWhereInput = {
      role: "MEMBER",
      status: "ACTIVE",
      ...(scope ?? {}),
      // only the owner can pick another trainer's roster
      ...(viewer.role === "ADMIN" && query.coachId ? { assignedCoachId: query.coachId } : {}),
      ...(query.search ? { OR: [{ firstName: { contains: query.search, mode: "insensitive" } }, { lastName: { contains: query.search, mode: "insensitive" } }, { memberNumber: { contains: query.search, mode: "insensitive" } }] } : {}),
    };

    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberNumber: true,
          createdAt: true,
          memberships: { select: { status: true, startDate: true, endDate: true, frozenFrom: true, frozenUntil: true } },
        },
        orderBy: { firstName: "asc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);
    const since30 = new Date(Date.now() - 30 * DAY_MS);
    const [visits, workouts, plans] = await Promise.all([
      this.prisma.client.gymVisit.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { checkedInAt: true } }),
      this.prisma.client.workoutResult.groupBy({ by: ["userId"], where: { userId: { in: ids }, completedAt: { gte: since30 } }, _count: { _all: true } }),
      this.prisma.client.workoutPlan.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "ACTIVE" }, _count: { _all: true } }),
    ]);
    const { expiringSoonDays } = await this.rules.get();

    const data = users.map((u) => {
      const current = pickCurrentMembership(u.memberships);
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        memberNumber: u.memberNumber,
        memberSince: u.createdAt,
        membershipStatus: current ? computeMembershipStatus(current, { expiringSoonDays }) : "NONE",
        lastVisitAt: visits.find((v) => v.userId === u.id)?._max.checkedInAt ?? null,
        workoutsLast30Days: workouts.find((w) => w.userId === u.id)?._count._all ?? 0,
        activePlans: plans.find((p) => p.userId === u.id)?._count._all ?? 0,
      };
    });
    return paginate(data, total, page, pageSize);
  }

  async detail(id: string, viewer: AuthenticatedUser) {
    await assertCanAccessClient(this.prisma, viewer, id);
    const db = this.prisma.client;
    const { expiringSoonDays } = await this.rules.get();
    const user = await db.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        memberNumber: true,
        createdAt: true,
        assignedCoach: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        memberships: { select: { status: true, startDate: true, endDate: true, frozenFrom: true, frozenUntil: true, plan: { select: { name: true, planType: true } } } },
        personalRecords: { orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, value: true, unit: true, achievedAt: true, verificationStatus: true, exercise: { select: { id: true, name: true } } } },
        workoutResults: { orderBy: { completedAt: "desc" }, take: 15, select: { id: true, completedAt: true, weightKg: true, reps: true, durationSeconds: true, rounds: true, wod: { select: { title: true } }, exercise: { select: { name: true } } } },
        trainerNotesAbout: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    const [progress, plans, sharedMeasurements, sharedPhotos] = await Promise.all([
      this.progress.summary(id),
      db.workoutPlan.findMany({ where: { userId: id, status: "ACTIVE" }, include: { items: { include: { exercise: { select: { name: true } } }, orderBy: [{ weekday: "asc" }, { position: "asc" }] } } }),
      db.bodyMeasurement.count({ where: { userId: id, sharedWithCoach: true } }),
      db.progressPhoto.count({ where: { userId: id, sharedWithCoach: true } }),
    ]);
    const noteAuthors = await db.user.findMany({ where: { id: { in: user.trainerNotesAbout.map((n) => n.authorId) } }, select: { id: true, firstName: true, lastName: true } });
    const current = pickCurrentMembership(user.memberships);
    const { memberships: _memberships, trainerNotesAbout, ...rest } = user;
    return {
      ...rest,
      membership: current ? { plan: current.plan.name, planType: current.plan.planType, status: computeMembershipStatus(current, { expiringSoonDays }), endDate: current.endDate, daysRemaining: daysRemaining(current.endDate) } : null,
      progress,
      plans: await Promise.all(plans.map(async (p) => ({ ...p, adherence: await this.plans.adherenceFor(p) }))),
      notes: trainerNotesAbout.map((n) => ({ ...n, author: noteAuthors.find((a) => a.id === n.authorId) ?? null })),
      // What the client has chosen to share: only counts here - the data itself is fetched from the body endpoints.
      shared: { measurements: sharedMeasurements, photos: sharedPhotos },
    };
  }

  // --- Notes ----------------------------------------------------------------------------------------------

  async addNote(memberId: string, body: string, viewer: AuthenticatedUser) {
    await assertCanAccessClient(this.prisma, viewer, memberId);
    const note = await this.prisma.client.trainerNote.create({ data: { memberId, authorId: viewer.sub, body } });
    await this.audit.record({ actorId: viewer.sub, action: "trainer_note.create", entityType: "TrainerNote", entityId: note.id, metadata: { memberId } });
    return note;
  }

  async deleteNote(noteId: string, viewer: AuthenticatedUser) {
    const note = await this.prisma.client.trainerNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException("Note not found");
    await assertCanAccessClient(this.prisma, viewer, note.memberId);
    if (viewer.role !== "ADMIN" && note.authorId !== viewer.sub) throw new ForbiddenException("You can only delete your own notes");
    await this.prisma.client.trainerNote.delete({ where: { id: noteId } });
    await this.audit.record({ actorId: viewer.sub, action: "trainer_note.delete", entityType: "TrainerNote", entityId: noteId, metadata: { memberId: note.memberId } });
    return { ok: true };
  }

  // --- Progress report (document 3.F) ------------------------------------------------------------------------

  /**
   * Workout frequency, plan adherence, strength progress, new PRs, shared body measurements, attendance and trainer
   * notes for one client over a period. Measurements appear ONLY if the member chose to share them; photos never appear
   * in a report. The same report serves trainers (their clients) and the owner.
   */
  async report(id: string, query: ClientReportQueryDto, viewer: AuthenticatedUser) {
    await assertCanAccessClient(this.prisma, viewer, id);
    const db = this.prisma.client;
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(gymPeriodStart("month", this.tz, now));
    const to = query.to ? new Date(query.to) : now;

    const [user, trainingDays, history, measurements, visits, classAttendance, notes, plans, prCount] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id }, select: { id: true, firstName: true, lastName: true, memberNumber: true } }),
      db.$queryRaw<Array<{ d: string; n: number }>>(Prisma.sql`
        SELECT to_char(date_trunc('day', "completedAt" AT TIME ZONE ${this.tz}), 'YYYY-MM-DD') AS d, COUNT(*)::int AS n
        FROM "WorkoutResult" WHERE "userId" = ${id} AND "completedAt" >= ${from} AND "completedAt" <= ${to} GROUP BY 1 ORDER BY 1`),
      db.personalRecordHistory.findMany({ where: { userId: id, achievedAt: { gte: from, lte: to } }, orderBy: { achievedAt: "asc" }, include: { exercise: { select: { id: true, name: true } } } }),
      db.bodyMeasurement.findMany({ where: { userId: id, sharedWithCoach: true, measuredAt: { gte: from, lte: to } }, orderBy: { measuredAt: "asc" } }),
      db.gymVisit.count({ where: { userId: id, checkedInAt: { gte: from, lte: to } } }),
      db.attendance.count({ where: { userId: id, status: "CHECKED_IN", class: { startTime: { gte: from, lte: to } } } }),
      db.trainerNote.findMany({ where: { memberId: id, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.workoutPlan.findMany({ where: { userId: id, status: "ACTIVE" }, include: { items: { select: { weekday: true } } } }),
      db.personalRecord.count({ where: { userId: id } }),
    ]);

    // Strength progress: for each lift with PR movement in the period, where it started and where it is now.
    const byExercise = new Map<string, typeof history>();
    for (const h of history) byExercise.set(h.exerciseId, [...(byExercise.get(h.exerciseId) ?? []), h]);
    const strengthProgress = [...byExercise.values()].map((entries) => {
      const first = entries[0];
      const last = entries[entries.length - 1];
      const start = Number(first.previousValue ?? first.newValue);
      const end = Number(last.newValue);
      return {
        exercise: first.exercise.name,
        unit: first.unit,
        startValue: start,
        currentValue: end,
        changePercent: start > 0 ? Math.round(((end - start) / start) * 100) : null,
        newRecords: entries.length,
        // For time-based records a LOWER value is an improvement; the sign is not flipped so the numbers stay honest.
      };
    });

    const measurementChanges = measurements.length
      ? (["weightKg", "bodyFatPercent", "chestCm", "waistCm", "hipsCm", "armCm", "thighCm"] as const)
          .map((field) => {
            const values = measurements.filter((m) => m[field] !== null);
            if (values.length === 0) return null;
            const a = Number(values[0][field]);
            const b = Number(values[values.length - 1][field]);
            return { field, first: a, latest: b, change: Number((b - a).toFixed(2)), readings: values.length };
          })
          .filter(Boolean)
      : [];

    const weeks = Math.max(1, (to.getTime() - from.getTime()) / (7 * DAY_MS));
    return {
      client: user,
      period: { from: from.toISOString(), to: to.toISOString() },
      workoutFrequency: { trainingDays: trainingDays.length, workoutsLogged: trainingDays.reduce((n, d) => n + d.n, 0), averageTrainingDaysPerWeek: Number((trainingDays.length / weeks).toFixed(1)) },
      planAdherence: await Promise.all(plans.map(async (p) => ({ planId: p.id, title: p.title, ...(await this.plans.adherenceFor(p)) }))),
      strengthProgress,
      newPersonalRecords: history.filter((h) => h.source === "AUTO_DETECTED" || h.source === "MANUAL").length,
      totalPersonalRecords: prCount,
      attendance: { gymVisits: visits, classesAttended: classAttendance },
      bodyMeasurements: {
        sharedByMember: measurements.length > 0,
        // When nothing is shared the report says so instead of showing empty numbers, so nobody mistakes it for "no change".
        note: measurements.length === 0 ? "The member has not shared body measurements for this period." : undefined,
        changes: measurementChanges,
      },
      trainerNotes: notes,
    };
  }
}
