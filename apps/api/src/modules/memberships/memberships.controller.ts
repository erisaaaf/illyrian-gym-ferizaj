import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { MembershipsService } from "./memberships.service";
import { MembershipRequestsService } from "./membership-requests.service";
import { CreateMembershipDto } from "./dto/create-membership.dto";
import { UpdateMembershipDto } from "./dto/update-membership.dto";
import { ListMembershipsQueryDto } from "./dto/list-memberships.query.dto";
import {
  CreateMembershipRequestDto,
  FreezeMembershipDto,
  HandleRequestDto,
  ListExpiringQueryDto,
  ListRequestsQueryDto,
  RenewMembershipDto,
  UnfreezeMembershipDto,
} from "./dto/memberships.dto";

/**
 * Reception and Admin sell, renew and freeze memberships (front-desk work). Cancelling a membership and editing
 * its dates by hand are Admin-only because they change what a member has paid for.
 */
@Controller()
export class MembershipsController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly requests: MembershipRequestsService,
  ) {}

  // --- The member's own
  @Get("memberships/me")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.memberships.findMineFor(user.sub);
  }

  @Get("memberships/me/history")
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.memberships.historyFor(user.sub);
  }

  @Post("membership-requests")
  createRequest(@Body() dto: CreateMembershipRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.create(user.sub, dto);
  }

  @Get("membership-requests/me")
  myRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.mine(user.sub);
  }

  // --- Staff
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("admin/memberships")
  list(@Query() query: ListMembershipsQueryDto) {
    return this.memberships.list(query);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("admin/memberships/expiring")
  expiring(@Query() query: ListExpiringQueryDto) {
    return this.memberships.expiring(query);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post("admin/memberships")
  create(@Body() dto: CreateMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.create(dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post("admin/memberships/:id/renew")
  renew(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RenewMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.renew(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @Post("admin/memberships/:id/freeze")
  freeze(@Param("id", ParseUUIDPipe) id: string, @Body() dto: FreezeMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.freeze(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @Post("admin/memberships/:id/unfreeze")
  unfreeze(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UnfreezeMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.unfreeze(id, dto.reason, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("admin/memberships/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("admin/memberships/:id/cancel")
  cancel(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.cancel(id, user.sub);
  }

  // --- Requests from members
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("admin/membership-requests")
  listRequests(@Query() query: ListRequestsQueryDto) {
    return this.requests.list(query);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @Post("admin/membership-requests/:id/approve")
  approve(@Param("id", ParseUUIDPipe) id: string, @Body() dto: HandleRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.approve(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @Post("admin/membership-requests/:id/reject")
  reject(@Param("id", ParseUUIDPipe) id: string, @Body() dto: HandleRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.reject(id, dto, user.sub);
  }
}
