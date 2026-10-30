import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { AttendanceService } from "./attendance.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { ListAttendanceQueryDto } from "./dto/list-attendance.query.dto";

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get("attendance/me")
  listMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.listMine(user.sub, query);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @Get("admin/attendance")
  list(@Query() query: ListAttendanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.list(query, user);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @Post("admin/attendance")
  mark(@Body() dto: MarkAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.mark(dto, user);
  }
}
