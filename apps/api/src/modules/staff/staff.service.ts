import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { Role } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { generateTempPassword } from "../../common/security/temp-password.util";
import { CreateStaffDto, SetStaffStatusDto, UpdateStaffDto } from "./staff.dto";

const STAFF_SELECT = { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true, mustChangePassword: true, createdAt: true } as const;

/**
 * Front-desk (Receptionist) accounts. Trainers have their own module because they also have a coach profile.
 * The owner account is deliberately not manageable here: this service only ever touches RECEPTIONIST users.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      role: Role.RECEPTIONIST,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({ where, select: STAFF_SELECT, orderBy: { createdAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.user.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateStaffDto, actorId: string) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.client.user.findUnique({ where: { email } })) throw new ConflictException("An account with this email already exists");

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, this.config.get<number>("BCRYPT_SALT_ROUNDS")!);
    const user = await this.prisma.client.user.create({
      data: { email, passwordHash, firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone, role: Role.RECEPTIONIST, mustChangePassword: true },
      select: STAFF_SELECT,
    });
    await this.audit.record({ actorId, action: "staff.create", entityType: "User", entityId: user.id, metadata: { email, role: "RECEPTIONIST" } });
    return { staff: user, temporaryPassword };
  }

  async update(id: string, dto: UpdateStaffDto, actorId: string) {
    await this.mustBeReceptionist(id);
    const user = await this.prisma.client.user.update({ where: { id }, data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone }, select: STAFF_SELECT });
    await this.audit.record({ actorId, action: "staff.update", entityType: "User", entityId: id });
    return user;
  }

  async setStatus(id: string, dto: SetStaffStatusDto, actorId: string) {
    const existing = await this.mustBeReceptionist(id);
    const user = await this.prisma.client.user.update({ where: { id }, data: { status: dto.status }, select: STAFF_SELECT });
    await this.audit.record({ actorId, action: "staff.status_change", entityType: "User", entityId: id, metadata: { from: existing.status, to: dto.status } });
    return user;
  }

  async resetPassword(id: string, actorId: string) {
    const existing = await this.mustBeReceptionist(id);
    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, this.config.get<number>("BCRYPT_SALT_ROUNDS")!);
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } }),
      this.prisma.client.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.record({ actorId, action: "staff.password_reset", entityType: "User", entityId: id });
    return { email: existing.email, temporaryPassword };
  }

  private async mustBeReceptionist(id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Staff member not found");
    if (user.role !== Role.RECEPTIONIST) throw new ForbiddenException("Only reception accounts can be managed here");
    return user;
  }
}
