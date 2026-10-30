import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { findCurrentMembership } from "../../common/current-membership";
import { paginate, skipTake } from "../../common/pagination.util";
import { MembershipsService } from "./memberships.service";
import { CreateMembershipRequestDto, HandleRequestDto, ListRequestsQueryDto } from "./dto/memberships.dto";

const REQUEST_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, memberNumber: true } },
  membership: { select: { id: true, endDate: true, plan: { select: { id: true, name: true } } } },
} satisfies Prisma.MembershipRequestInclude;

/** "Request renewal" / "Request freeze" from the member app. A request does nothing until staff approve it. */
@Injectable()
export class MembershipRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly memberships: MembershipsService,
  ) {}

  async create(userId: string, dto: CreateMembershipRequestDto) {
    const membership = await findCurrentMembership(this.prisma, userId);
    if (!membership) throw new BadRequestException("You do not have a membership to renew or freeze. Please ask the front desk.");

    if (dto.type === "FREEZE") {
      if (!dto.requestedFrom || !dto.requestedUntil) throw new BadRequestException("Choose the dates you want the freeze to cover");
      if (new Date(dto.requestedUntil) <= new Date(dto.requestedFrom)) throw new BadRequestException("The freeze must end after it starts");
    }
    const pending = await this.prisma.client.membershipRequest.findFirst({ where: { userId, type: dto.type, status: "PENDING" } });
    if (pending) throw new ConflictException("You already have a pending request of this kind. The gym will get back to you.");

    const request = await this.prisma.client.membershipRequest.create({
      data: {
        userId,
        membershipId: membership.id,
        type: dto.type,
        requestedFrom: dto.requestedFrom ? new Date(dto.requestedFrom) : undefined,
        requestedUntil: dto.requestedUntil ? new Date(dto.requestedUntil) : undefined,
        note: dto.note,
      },
      include: REQUEST_INCLUDE,
    });
    await this.audit.record({ actorId: userId, action: "membership_request.create", entityType: "MembershipRequest", entityId: request.id, metadata: { type: dto.type } });
    return request;
  }

  async mine(userId: string) {
    return this.prisma.client.membershipRequest.findMany({ where: { userId }, include: REQUEST_INCLUDE, orderBy: { createdAt: "desc" }, take: 20 });
  }

  async list(query: ListRequestsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.MembershipRequestWhereInput = { ...(query.status ? { status: query.status } : {}) };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.membershipRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: [{ status: "asc" }, { createdAt: "desc" }], ...skipTake(page, pageSize) }),
      this.prisma.client.membershipRequest.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  /** Approving performs the action (renewal or freeze) and only then marks the request handled. */
  async approve(id: string, dto: HandleRequestDto, actorId: string) {
    const request = await this.load(id);
    if (!request.membershipId) throw new BadRequestException("This request has no membership attached");

    if (request.type === "RENEWAL") {
      await this.memberships.renew(request.membershipId, {}, actorId);
    } else {
      if (!request.requestedFrom || !request.requestedUntil) throw new BadRequestException("The request has no dates");
      await this.memberships.freeze(
        request.membershipId,
        { from: request.requestedFrom.toISOString(), until: request.requestedUntil.toISOString(), reason: request.note ?? "Requested by the member" },
        actorId,
      );
    }
    return this.finish(id, "APPROVED", dto.note, actorId);
  }

  async reject(id: string, dto: HandleRequestDto, actorId: string) {
    await this.load(id);
    return this.finish(id, "REJECTED", dto.note, actorId);
  }

  private async load(id: string) {
    const request = await this.prisma.client.membershipRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Request not found");
    if (request.status !== "PENDING") throw new BadRequestException("This request has already been handled");
    return request;
  }

  private async finish(id: string, status: "APPROVED" | "REJECTED", note: string | undefined, actorId: string) {
    const request = await this.prisma.client.membershipRequest.update({
      where: { id },
      data: { status, handledById: actorId, handledAt: new Date(), handledNote: note },
      include: REQUEST_INCLUDE,
    });
    await this.audit.record({ actorId, action: `membership_request.${status.toLowerCase()}`, entityType: "MembershipRequest", entityId: id, metadata: { type: request.type, note } });
    return request;
  }
}
