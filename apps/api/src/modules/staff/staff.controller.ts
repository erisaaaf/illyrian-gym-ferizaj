import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { StaffService } from "./staff.service";
import { CreateStaffDto, SetStaffStatusDto, UpdateStaffDto } from "./staff.dto";

// Only the owner creates and manages staff accounts.
@Roles(Role.ADMIN)
@Controller("admin/staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.staff.list(query);
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.create(dto, user.sub);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.update(id, dto, user.sub);
  }

  @Patch(":id/status")
  setStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetStaffStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.setStatus(id, dto, user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Post(":id/reset-password")
  resetPassword(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.resetPassword(id, user.sub);
  }
}
