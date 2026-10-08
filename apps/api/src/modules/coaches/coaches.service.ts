import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { Role, UserStatus } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { paginate, skipTake } from "../../common/pagination.util";
import { generateTempPassword } from "../../common/security/temp-password.util";
import { CreateCoachDto } from "./dto/create-coach.dto";
import { UpdateCoachDto } from "./dto/update-coach.dto";

const COACH_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      profileImageUrl: true,
      createdAt: true,
    },
  },
} as const;

@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.search
      ? {
          user: {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          },
        }
      : {};

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.coach.findMany({
        where,
        include: COACH_INCLUDE,
        orderBy: { createdAt: "desc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.coach.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }

  async findByUserId(userId: string) {
    const coach = await this.prisma.client.coach.findUnique({ where: { userId }, include: COACH_INCLUDE });
    if (!coach) throw new NotFoundException("No coach profile for this account");
    return coach;
  }

  async findOne(id: string) {
    const coach = await this.prisma.client.coach.findUnique({
      where: { id },
      include: {
        ...COACH_INCLUDE,
        classes: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { startTime: "asc" },
          take: 20,
          select: { id: true, title: true, startTime: true, endTime: true, capacity: true, bookedCount: true, status: true },
        },
      },
    });
    if (!coach) throw new NotFoundException("Coach not found");
    return coach;
  }

  async create(dto: CreateCoachDto, actorId: string) {
    const existing = await this.prisma.client.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const tempPassword = generateTempPassword();
    const saltRounds = this.config.get<number>("BCRYPT_SALT_ROUNDS")!;
    const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

    const coach = await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: Role.COACH,
        },
      });
      return tx.coach.create({
        data: {
          userId: user.id,
          bio: dto.bio,
          certifications: dto.certifications ?? [],
          specialties: dto.specialties ?? [],
        },
        include: COACH_INCLUDE,
      });
    });

    await this.audit.record({
      actorId,
      action: "coach.create",
      entityType: "Coach",
      entityId: coach.id,
      metadata: { email: dto.email.toLowerCase() },
    });

    // No email provider configured (see MailerService) - the temporary
    // password is returned once here for the admin to relay to the coach.
    return { coach, temporaryPassword: tempPassword };
  }

  async update(id: string, dto: UpdateCoachDto, actorId: string) {
    const existing = await this.prisma.client.coach.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Coach not found");

    const coach = await this.prisma.client.$transaction(async (tx) => {
      if (dto.firstName || dto.lastName || dto.phone !== undefined) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone },
        });
      }
      return tx.coach.update({
        where: { id },
        data: {
          bio: dto.bio,
          certifications: dto.certifications,
          specialties: dto.specialties,
          isActive: dto.isActive,
        },
        include: COACH_INCLUDE,
      });
    });

    await this.audit.record({ actorId, action: "coach.update", entityType: "Coach", entityId: id });
    return coach;
  }

  /** Issues a fresh temporary password (shown once) and signs the trainer out everywhere. */
  async resetPassword(id: string, actorId: string) {
    const existing = await this.prisma.client.coach.findUnique({ where: { id }, include: { user: true } });
    if (!existing) throw new NotFoundException("Coach not found");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, this.config.get<number>("BCRYPT_SALT_ROUNDS")!);

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id: existing.userId }, data: { passwordHash } }),
      this.prisma.client.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({ actorId, action: "coach.password_reset_by_admin", entityType: "Coach", entityId: id });
    return { email: existing.user.email, temporaryPassword: tempPassword };
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    const existing = await this.prisma.client.coach.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Coach not found");

    const coach = await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: { status: isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE },
      });
      return tx.coach.update({ where: { id }, data: { isActive }, include: COACH_INCLUDE });
    });

    await this.audit.record({
      actorId,
      action: isActive ? "coach.reactivate" : "coach.deactivate",
      entityType: "Coach",
      entityId: id,
    });
    return coach;
  }
}
