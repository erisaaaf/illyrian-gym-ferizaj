import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { ProgressService } from "../progress/progress.service";
import { computeMembershipStatus } from "../../common/membership-status.util";
import { gymTodayDate } from "../../common/gym-time";
import { SendMessageDto } from "./dto/send-message.dto";
import { ChatTurn, CoachContext, CoachProvider } from "./ai-coach.types";
import { LocalCoachProvider } from "./local-coach.provider";
import { OpenAiCoachProvider } from "./openai-coach.provider";

const DAY_MS = 86_400_000;
const num = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? null : Number(v.toString()));

@Injectable()
export class AiCoachService {
  private readonly logger = new Logger(AiCoachService.name);
  private readonly local = new LocalCoachProvider();
  private readonly primary: CoachProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly progress: ProgressService,
  ) {
    const key = this.config.get<string>("OPENAI_API_KEY");
    this.primary = key
      ? new OpenAiCoachProvider(key, this.config.get<string>("OPENAI_MODEL")!, this.config.get<number>("AI_MAX_OUTPUT_TOKENS")!)
      : this.local;
  }

  /** Which engine answers: "openai" when a key is configured, otherwise the data-only "local" assistant. */
  get providerName() {
    return this.primary.name;
  }

  async send(userId: string, dto: SendMessageDto) {
    await this.enforceDailyLimit(userId);

    let conversationId = dto.conversationId;
    if (conversationId) {
      const owned = await this.prisma.client.aIConversation.findFirst({ where: { id: conversationId, userId }, select: { id: true } });
      if (!owned) throw new NotFoundException("Conversation not found");
    } else {
      const created = await this.prisma.client.aIConversation.create({ data: { userId, title: dto.message.slice(0, 60) } });
      conversationId = created.id;
    }

    const previous = await this.prisma.client.aIMessage.findMany({
      where: { conversationId, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const history: ChatTurn[] = previous.reverse().map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content }));

    await this.prisma.client.aIMessage.create({ data: { conversationId, role: "USER", content: dto.message } });

    const context = await this.buildContext(userId);
    let provider = this.primary;
    let content: string;
    try {
      content = await provider.reply({ message: dto.message, history, context });
    } catch (err) {
      // An outage at the AI vendor must not break the feature: answer from the member's own data instead, and say which engine answered.
      this.logger.warn(`AI provider "${provider.name}" failed (${(err as Error).message}); using the local assistant`);
      provider = this.local;
      content = await provider.reply({ message: dto.message, history, context });
    }

    const reply = await this.prisma.client.aIMessage.create({ data: { conversationId, role: "ASSISTANT", content } });
    await this.prisma.client.aIConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    return {
      conversationId,
      provider: provider.name,
      message: { id: reply.id, role: reply.role, content: reply.content, createdAt: reply.createdAt },
    };
  }

  /** The member's most recent conversation (oldest message first), for restoring the chat screen. */
  async latest(userId: string) {
    const conversation = await this.prisma.client.aIConversation.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { messages: { where: { role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "desc" }, take: 50 } },
    });
    return {
      provider: this.providerName,
      conversationId: conversation?.id ?? null,
      messages: (conversation?.messages ?? []).reverse().map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
    };
  }

  private async enforceDailyLimit(userId: string) {
    const limit = this.config.get<number>("AI_RATE_LIMIT_PER_USER_PER_DAY")!;
    const used = await this.prisma.client.aIMessage.count({
      where: { role: "USER", createdAt: { gte: new Date(Date.now() - DAY_MS) }, conversation: { userId } },
    });
    if (used >= limit) {
      throw new HttpException(`You have reached today's limit of ${limit} assistant messages. Try again tomorrow.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async buildContext(userId: string): Promise<CoachContext> {
    const db = this.prisma.client;
    const tz = this.config.get<string>("GYM_TIMEZONE")!;

    const [user, membership, wod, prs, workouts, progress, bookings] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true } }),
      db.membership.findFirst({ where: { userId }, orderBy: { endDate: "desc" }, include: { plan: { select: { name: true } } } }),
      db.wod.findFirst({
        where: { date: gymTodayDate(tz), status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        include: { sections: { orderBy: { order: "asc" }, include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } } } } } } },
      }),
      db.personalRecord.findMany({
        where: { userId },
        orderBy: { achievedAt: "desc" },
        take: 15,
        include: { exercise: { select: { name: true } } },
      }),
      db.workoutResult.findMany({
        where: { userId },
        orderBy: { completedAt: "desc" },
        take: 8,
        include: { exercise: { select: { name: true } }, wod: { select: { title: true } } },
      }),
      this.progress.summary(userId),
      db.booking.findMany({
        where: { userId, status: { in: ["BOOKED", "WAITLISTED"] }, class: { endTime: { gte: new Date() } } },
        orderBy: { class: { startTime: "asc" } },
        take: 5,
        include: { class: { select: { title: true, startTime: true } } },
      }),
    ]);

    return {
      member: { firstName: user.firstName },
      membership: membership
        ? { status: computeMembershipStatus(membership), endDate: membership.endDate.toISOString(), planName: membership.plan.name }
        : null,
      todaysWod: wod
        ? {
            title: wod.title,
            type: wod.type,
            sections: wod.sections.map((s) => ({
              type: s.type,
              notes: s.notes,
              exercises: s.exercises.map((e) => ({
                name: e.exercise.name,
                sets: e.sets,
                reps: e.reps,
                weightKg: num(e.weightKg),
                durationSeconds: e.durationSeconds,
                rounds: e.rounds,
              })),
            })),
          }
        : null,
      personalRecords: prs.map((p) => ({
        exercise: p.exercise.name,
        value: Number(p.value.toString()),
        unit: p.unit,
        achievedAt: p.achievedAt.toISOString(),
        verified: p.verificationStatus === "VERIFIED",
      })),
      recentWorkouts: workouts.map((w) => ({
        exercise: w.exercise?.name ?? null,
        wod: w.wod?.title ?? null,
        completedAt: w.completedAt.toISOString(),
        weightKg: num(w.weightKg),
        reps: w.reps,
        durationSeconds: w.durationSeconds,
      })),
      progress: {
        workoutsCompleted: progress.workoutsCompleted,
        classesAttended: progress.classesAttended,
        prCount: progress.prCount,
        currentStreakDays: progress.currentStreakDays,
        trainingDaysLast30: progress.trainingDaysLast30,
      },
      upcomingClasses: bookings.map((b) => ({ title: b.class.title, startTime: b.class.startTime.toISOString(), status: b.status })),
    };
  }
}
