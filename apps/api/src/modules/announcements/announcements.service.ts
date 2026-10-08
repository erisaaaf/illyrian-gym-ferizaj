import { Injectable, NotFoundException } from "@nestjs/common";
import { AnnouncementStatus, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { paginate, skipTake } from "../../common/pagination.util";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto, isStaff: boolean) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const now = new Date();

    const where: Prisma.AnnouncementWhereInput = isStaff
      ? {}
      : { status: AnnouncementStatus.PUBLISHED, OR: [{ publishAt: null }, { publishAt: { lte: now } }] };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.announcement.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.announcement.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateAnnouncementDto, actorId: string) {
    const announcement = await this.prisma.client.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        imageUrl: dto.imageUrl,
        priority: dto.priority ?? "NORMAL",
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        createdById: actorId,
      },
    });
    await this.audit.record({ actorId, action: "announcement.create", entityType: "Announcement", entityId: announcement.id });
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto, actorId: string) {
    const existing = await this.prisma.client.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Announcement not found");

    const announcement = await this.prisma.client.announcement.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        imageUrl: dto.imageUrl,
        priority: dto.priority,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        status: dto.status,
      },
    });
    await this.audit.record({ actorId, action: "announcement.update", entityType: "Announcement", entityId: id });
    return announcement;
  }

  async setStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", actorId: string) {
    const existing = await this.prisma.client.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Announcement not found");

    const announcement = await this.prisma.client.announcement.update({ where: { id }, data: { status } });
    await this.audit.record({ actorId, action: `announcement.${status.toLowerCase()}`, entityType: "Announcement", entityId: id });
    return announcement;
  }
}
