import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { NotificationType, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { assertCanAccessClient } from "../../common/client-access";
import { GymRulesService } from "../../common/gym-rules.service";
import { runningNow } from "../../common/membership-where";
import { paginate, skipTake } from "../../common/pagination.util";
import { ListMessagesQueryDto, MessageDto } from "./communications.dto";

const DAY_MS = 86_400_000;
const MAX_RECIPIENTS = 2000;

type Audience = MessageDto["audience"];

/** Which audiences each role may write to. A trainer can only reach their own clients; reception handles reminders. */
const ALLOWED: Record<string, Audience[]> = {
  ADMIN: ["INDIVIDUAL", "ALL_ACTIVE", "EXPIRING_SOON", "EXPIRED", "UNPAID", "AT_RISK"],
  RECEPTIONIST: ["INDIVIDUAL", "EXPIRING_SOON", "EXPIRED", "UNPAID"],
  COACH: ["INDIVIDUAL", "ASSIGNED_CLIENTS"],
};

/**
 * Messages from the gym to members, individually or by group. Delivery is IN-APP: a Notification is created for each
 * recipient, so "delivered" means "it is in the member's app" and "read" is the notification's real readAt. No e-mail,
 * SMS or push provider is configured, so none is claimed.
 */
@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: GymRulesService,
  ) {}

  /** Who would receive this message, without sending it. */
  async preview(dto: MessageDto, viewer: AuthenticatedUser) {
    const ids = await this.resolve(dto, viewer);
    const sample = await this.prisma.client.user.findMany({ where: { id: { in: ids.slice(0, 5) } }, select: { firstName: true, lastName: true, memberNumber: true } });
    return { recipientCount: ids.length, sample, limit: MAX_RECIPIENTS, channels: { inApp: true, email: false, sms: false, push: false } };
  }

  async send(dto: MessageDto, viewer: AuthenticatedUser) {
    const ids = await this.resolve(dto, viewer);
    if (ids.length === 0) throw new BadRequestException("No members match this audience, so nothing was sent.");
    if (ids.length > MAX_RECIPIENTS) throw new BadRequestException(`This would reach ${ids.length} members; the limit for one message is ${MAX_RECIPIENTS}.`);
    if (viewer.role === "COACH" && dto.type && dto.type !== "MESSAGE") throw new ForbiddenException("Trainers can send ordinary messages only");

    const type = (dto.type ?? "MESSAGE") as NotificationType;
    const notificationIds = ids.map(() => randomUUID());

    const message = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.message.create({ data: { subject: dto.subject, body: dto.body, type, audience: dto.audience, sentById: viewer.sub, recipientCount: ids.length } });
      await tx.notification.createMany({ data: ids.map((userId, i) => ({ id: notificationIds[i], userId, type, title: dto.subject, body: dto.body, data: { messageId: created.id } })) });
      await tx.messageRecipient.createMany({ data: ids.map((userId, i) => ({ messageId: created.id, userId, notificationId: notificationIds[i] })) });
      return created;
    });
    await this.audit.record({ actorId: viewer.sub, action: "message.send", entityType: "Message", entityId: message.id, metadata: { audience: dto.audience, recipients: ids.length, type } });
    return { ...message, delivered: ids.length, read: 0 };
  }

  async history(query: ListMessagesQueryDto, viewer: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    // Trainers see only what they sent themselves.
    const where: Prisma.MessageWhereInput = {
      ...(viewer.role === "COACH" ? { sentById: viewer.sub } : {}),
      ...(query.search ? { OR: [{ subject: { contains: query.search, mode: "insensitive" } }, { body: { contains: query.search, mode: "insensitive" } }] } : {}),
    };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.message.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.message.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const read = ids.length
      ? await this.prisma.client.$queryRaw<Array<{ messageId: string; n: number }>>(Prisma.sql`
          SELECT mr."messageId", COUNT(*)::int AS n FROM "MessageRecipient" mr JOIN "Notification" n ON n.id = mr."notificationId"
          WHERE mr."messageId" IN (${Prisma.join(ids)}) AND n."readAt" IS NOT NULL GROUP BY mr."messageId"`)
      : [];
    const senders = await this.prisma.client.user.findMany({ where: { id: { in: rows.map((r) => r.sentById) } }, select: { id: true, firstName: true, lastName: true } });
    return paginate(
      rows.map((r) => ({ ...r, delivered: r.recipientCount, read: read.find((x) => x.messageId === r.id)?.n ?? 0, sentBy: senders.find((s) => s.id === r.sentById) ?? null, channel: "in-app" })),
      total,
      page,
      pageSize,
    );
  }

  async detail(id: string, viewer: AuthenticatedUser) {
    const message = await this.prisma.client.message.findUnique({ where: { id } });
    if (!message || (viewer.role === "COACH" && message.sentById !== viewer.sub)) throw new NotFoundException("Message not found");
    const recipients = await this.prisma.client.messageRecipient.findMany({ where: { messageId: id }, include: { user: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } }, take: 500 });
    const notifications = await this.prisma.client.notification.findMany({ where: { id: { in: recipients.map((r) => r.notificationId).filter((x): x is string => !!x) } }, select: { id: true, readAt: true } });
    const readAt = new Map(notifications.map((n) => [n.id, n.readAt]));
    return { ...message, recipients: recipients.map((r) => ({ user: r.user, deliveredInApp: true, readAt: (r.notificationId && readAt.get(r.notificationId)) || null })) };
  }

  // --- Audiences ---------------------------------------------------------------------------------------

  private async resolve(dto: MessageDto, viewer: AuthenticatedUser): Promise<string[]> {
    const allowed = ALLOWED[viewer.role] ?? [];
    if (!allowed.includes(dto.audience)) throw new ForbiddenException("Your role cannot send to this audience");
    const db = this.prisma.client;
    const rules = await this.rules.get();
    const now = new Date();
    const active: Prisma.UserWhereInput = { role: "MEMBER", status: "ACTIVE" };

    switch (dto.audience) {
      case "INDIVIDUAL": {
        if (!dto.userId) throw new BadRequestException("Choose the member to message");
        if (viewer.role === "COACH") await assertCanAccessClient(this.prisma, viewer, dto.userId);
        const user = await db.user.findFirst({ where: { id: dto.userId, role: "MEMBER", status: "ACTIVE" }, select: { id: true } });
        if (!user) throw new NotFoundException("Member not found or not active");
        return [user.id];
      }
      case "ALL_ACTIVE":
        return this.ids({ ...active, memberships: { some: runningNow(now) } });
      case "EXPIRING_SOON": {
        const soon = new Date(now.getTime() + rules.expiringSoonDays * DAY_MS);
        return this.ids({ ...active, memberships: { some: { status: "ACTIVE", endDate: { gte: now, lte: soon }, renewals: { none: { status: "ACTIVE" } } } } });
      }
      case "EXPIRED":
        return this.ids({ ...active, memberships: { some: {} }, NOT: { memberships: { some: { status: "ACTIVE", endDate: { gte: now } } } } });
      case "UNPAID": {
        const rows = await db.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
          SELECT i."userId" FROM "Invoice" i
          LEFT JOIN (SELECT "invoiceId", SUM("amountCents") AS paid FROM "Payment" WHERE status = 'COMPLETED' GROUP BY "invoiceId") p ON p."invoiceId" = i.id
          WHERE i.status = 'OPEN' GROUP BY i."userId" HAVING SUM(GREATEST(i."totalCents" - COALESCE(p.paid, 0), 0)) > 0`);
        return this.ids({ ...active, id: { in: rows.map((r) => r.userId) } });
      }
      case "AT_RISK": {
        const since = new Date(now.getTime() - rules.atRiskShortDays * DAY_MS);
        return this.ids({ ...active, createdAt: { lt: since }, memberships: { some: runningNow(now) }, visits: { none: { checkedInAt: { gte: since } } } });
      }
      case "ASSIGNED_CLIENTS":
        return this.ids({ ...active, assignedCoach: { userId: viewer.sub } });
    }
  }

  private async ids(where: Prisma.UserWhereInput): Promise<string[]> {
    const rows = await this.prisma.client.user.findMany({ where, select: { id: true }, take: MAX_RECIPIENTS + 1 });
    return rows.map((r) => r.id);
  }
}
