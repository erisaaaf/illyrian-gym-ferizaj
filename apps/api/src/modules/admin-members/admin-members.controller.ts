import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AdminMembersService } from "./admin-members.service";
import { ListMembersQueryDto } from "./dto/list-members.query.dto";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { SetMemberStatusDto } from "./dto/set-member-status.dto";

// Full member management (create, edit, status) is admin-only. Coaches get
// a narrower view of their own class participants through the classes
// module instead of full member records - see spec section 8/56.
@Roles(Role.ADMIN)
@Controller("admin/members")
export class AdminMembersController {
  constructor(private readonly membersService: AdminMembersService) {}

  @Get()
  list(@Query() query: ListMembersQueryDto) {
    return this.membersService.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.membersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.create(dto, user.sub);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.update(id, dto, user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Post(":id/reset-password")
  resetPassword(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.resetPassword(id, user.sub);
  }

  @Patch(":id/status")
  setStatus(@Param("id") id: string, @Body() dto: SetMemberStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.setStatus(id, dto, user.sub);
  }
}
