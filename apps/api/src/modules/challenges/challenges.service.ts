import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { paginate, skipTake } from "../../common/pagination.util";
import { CreateChallengeDto } from "./dto/create-challenge.dto";
import { UpdateChallengeDto } from "./dto/update-challenge.dto";

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {};

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.challenge.findMany({
        where,
        orderBy: { startDate: "desc" },
        include: { _count: { select: { participants: true } } },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.challenge.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string) {
    const challenge = await this.prisma.client.challenge.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } },
    });
    if (!challenge) throw new NotFoundException("Challenge not found");
    return challenge;
  }

  async leaderboard(id: string) {
    await this.findOne(id);
    return this.prisma.client.challengeParticipant.findMany({
      where: { challengeId: id },
      orderBy: { points: "desc" },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async create(dto: CreateChallengeDto, actorId: string) {
    const challenge = await this.prisma.client.challenge.create({
      data: {
        title: dto.title,
        description: dto.description,
        rules: dto.rules,
        pointsLabel: dto.pointsLabel ?? "points",
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        createdById: actorId,
      },
    });
    await this.audit.record({ actorId, action: "challenge.create", entityType: "Challenge", entityId: challenge.id });
    return challenge;
  }

  async update(id: string, dto: UpdateChallengeDto, actorId: string) {
    const existing = await this.prisma.client.challenge.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Challenge not found");

    const challenge = await this.prisma.client.challenge.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        rules: dto.rules,
        pointsLabel: dto.pointsLabel,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
      },
    });
    await this.audit.record({ actorId, action: "challenge.update", entityType: "Challenge", entityId: id });
    return challenge;
  }

  async join(id: string, userId: string) {
    const challenge = await this.prisma.client.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException("Challenge not found");

    const existing = await this.prisma.client.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId: id, userId } },
    });
    if (existing) throw new ConflictException("You have already joined this challenge");

    return this.prisma.client.challengeParticipant.create({ data: { challengeId: id, userId } });
  }
}
