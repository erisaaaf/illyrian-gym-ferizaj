import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { CoachesService } from "./coaches.service";
import { CreateCoachDto } from "./dto/create-coach.dto";
import { UpdateCoachDto } from "./dto/update-coach.dto";

@Controller("coaches")
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  // Open to any authenticated role - members browse coach profiles too.
  @Get()
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.list(query, user);
  }

  @Get("me")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.findByUserId(user.sub);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.findOne(id, user);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateCoachDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCoachDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post(":id/reset-password")
  resetPassword(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.resetPassword(id, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/deactivate")
  deactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.setActive(id, false, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/reactivate")
  reactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coachesService.setActive(id, true, user.sub);
  }
}
