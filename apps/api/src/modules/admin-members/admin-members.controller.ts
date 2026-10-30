import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AdminMembersService } from "./admin-members.service";
import { ListMembersQueryDto } from "./dto/list-members.query.dto";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { SetMemberStatusDto } from "./dto/set-member-status.dto";

/**
 * Front desk (Reception) and the owner (Admin) register and look after members. Suspending/deactivating an
 * account and assigning a trainer stay with the owner. Trainers do not use this controller at all: they get a
 * narrower view of only their own clients (see the clients module).
 */
@Controller("admin/members")
export class AdminMembersController {
  constructor(private readonly membersService: AdminMembersService) {}

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get()
  list(@Query() query: ListMembersQueryDto) {
    return this.membersService.list(query);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.create(dto, user);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.update(id, dto, user);
  }

  // A lost temporary password is a front-desk problem; it only affects member accounts.
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @Post(":id/reset-password")
  resetPassword(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.resetPassword(id, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/status")
  setStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetMemberStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.setStatus(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get(":id/qr")
  qr(@Param("id", ParseUUIDPipe) id: string) {
    return this.membersService.qrFor(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @Post(":id/qr/reissue")
  reissueQr(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.reissueQr(id, user.sub);
  }
}
