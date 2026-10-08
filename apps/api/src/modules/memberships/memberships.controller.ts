import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { MembershipsService } from "./memberships.service";
import { CreateMembershipDto } from "./dto/create-membership.dto";
import { UpdateMembershipDto } from "./dto/update-membership.dto";
import { ListMembershipsQueryDto } from "./dto/list-memberships.query.dto";

@Controller()
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  // Any authenticated member - their own current/most-recent membership.
  @Get("memberships/me")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.findMineFor(user.sub);
  }

  @Roles(Role.ADMIN)
  @Get("admin/memberships")
  list(@Query() query: ListMembershipsQueryDto) {
    return this.membershipsService.list(query);
  }

  @Roles(Role.ADMIN)
  @Post("admin/memberships")
  create(@Body() dto: CreateMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("admin/memberships/:id")
  update(@Param("id") id: string, @Body() dto: UpdateMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("admin/memberships/:id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.cancel(id, user.sub);
  }
}
