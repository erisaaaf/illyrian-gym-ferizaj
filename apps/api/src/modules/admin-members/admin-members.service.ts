import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { Prisma, Role } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { generateTempPassword } from "../../common/security/temp-password.util";
import { computeMembershipStatus } from "../../common/membership-status.util";
import { ListMembersQueryDto } from "./dto/list-members.query.dto";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { SetMemberStatusDto } from "./dto/set-member-status.dto";

const MEMBER_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  memberships: {
    orderBy: { endDate: "desc" as const },
    take: 1,
    select: { id: true, status: true, endDate: true, paymentStatus: true, plan: { select: { name: true } } },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListMembersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = {
      role: Role.MEMBER,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where,
        select: MEMBER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.user.count({ where }),
    ]);

    const data = users.map((u) => this.withComputedMembership(u));
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, role: Role.MEMBER },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          orderBy: { startDate: "desc" },
          select: { id: true, startDate: true, endDate: true, status: true, paymentStatus: true, plan: { select: { name: true } } },
        },
        bookings: {
          where: { status: { in: ["BOOKED", "WAITLISTED"] }, class: { startTime: { gte: new Date() } } },
          orderBy: { class: { startTime: "asc" } },
          take: 10,
          select: {
            id: true,
            status: true,
            class: { select: { id: true, title: true, startTime: true, endTime: true } },
          },
        },
        attendance: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, status: true, checkedInAt: true, class: { select: { title: true, startTime: true } } },
        },
        workoutResults: {
          orderBy: { completedAt: "desc" },
          take: 10,
          select: { id: true, completedAt: true, wod: { select: { title: true } }, exercise: { select: { name: true } } },
        },
        personalRecords: {
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            value: true,
            unit: true,
            achievedAt: true,
            verificationStatus: true,
            exercise: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("Member not found");

    const { memberships, ...rest } = user;
    return {
      ...rest,
      memberships: memberships.map((m) => ({ ...m, computedStatus: computeMembershipStatus(m) })),
    };
  }

  async create(dto: CreateMemberDto, actorId: string) {
    const existing = await this.prisma.client.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const tempPassword = generateTempPassword();
    const saltRounds = this.config.get<number>("BCRYPT_SALT_ROUNDS")!;
    const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: Role.MEMBER,
      },
      select: MEMBER_LIST_SELECT,
    });

    await this.audit.record({
      actorId,
      action: "member.create",
      entityType: "User",
      entityId: user.id,
      metadata: { email: dto.email.toLowerCase() },
    });

    return { member: this.withComputedMembership(user), temporaryPassword: tempPassword };
  }

  async update(id: string, dto: UpdateMemberDto, actorId: string) {
    const existing = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!existing) throw new NotFoundException("Member not found");

    const user = await this.prisma.client.user.update({
      where: { id },
      data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone },
      select: MEMBER_LIST_SELECT,
    });

    await this.audit.record({ actorId, action: "member.update", entityType: "User", entityId: id });
    return this.withComputedMembership(user);
  }

  async setStatus(id: string, dto: SetMemberStatusDto, actorId: string) {
    const existing = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!existing) throw new NotFoundException("Member not found");

    const user = await this.prisma.client.user.update({
      where: { id },
      data: { status: dto.status },
      select: MEMBER_LIST_SELECT,
    });

    await this.audit.record({
      actorId,
      action: "member.status_change",
      entityType: "User",
      entityId: id,
      metadata: { from: existing.status, to: dto.status },
    });
    return this.withComputedMembership(user);
  }

  /** Issues a fresh temporary password (shown once) and signs the member out everywhere. */
  async resetPassword(id: string, actorId: string) {
    const existing = await this.prisma.client.user.findFirst({ where: { id, role: Role.MEMBER } });
    if (!existing) throw new NotFoundException("Member not found");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, this.config.get<number>("BCRYPT_SALT_ROUNDS")!);

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id }, data: { passwordHash } }),
      this.prisma.client.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await this.audit.record({ actorId, action: "member.password_reset_by_admin", entityType: "User", entityId: id });
    return { email: existing.email, temporaryPassword: tempPassword };
  }

  private withComputedMembership<T extends { memberships: Array<{ status: "ACTIVE" | "CANCELLED"; endDate: Date }> }>(
    user: T,
  ) {
    const latest = user.memberships[0];
    return {
      ...user,
      membershipStatus: latest ? computeMembershipStatus(latest) : ("NONE" as const),
    };
  }
}
