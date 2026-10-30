import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { CheckInService } from "./check-in.service";
import { CheckInDto, ListVisitsQueryDto } from "./dto/check-in.dto";

@Controller()
export class CheckInController {
  constructor(private readonly checkIn: CheckInService) {}

  // --- Reception desk
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @Post("admin/check-in")
  record(@Body() dto: CheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checkIn.checkIn(dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("admin/check-in/today")
  today() {
    return this.checkIn.today();
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("admin/visits")
  list(@Query() query: ListVisitsQueryDto) {
    return this.checkIn.list(query);
  }

  // --- The member's own
  @Get("me/card")
  card(@CurrentUser() user: AuthenticatedUser) {
    return this.checkIn.card(user.sub);
  }

  @Get("visits/me")
  mine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checkIn.mine(user.sub, query);
  }
}
