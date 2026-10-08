import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { ListNotificationsQueryDto } from "./dto/list-notifications.query.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, query: ListNotificationsQueryDto) {
    return this.list({ ...query, userId });
  }

  /** Staff activity view (spec section 20) - who got notified about what. */
  async list(query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const where: Prisma.NotificationWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.unreadOnly === "true" ? { readAt: null } : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: query.userId ? undefined : { user: { select: { id: true, firstName: true, lastName: true } } },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.notification.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.client.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("Notification not found");
    if (notification.userId !== userId) throw new ForbiddenException("Not your notification");

    return this.prisma.client.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.client.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
