import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { WodsService } from "./wods.service";
import { CreateWodDto } from "./dto/create-wod.dto";
import { UpdateWodDto } from "./dto/update-wod.dto";
import { ListWodsQueryDto } from "./dto/list-wods.query.dto";

function isStaff(user: AuthenticatedUser) {
  return user.role === Role.ADMIN || user.role === Role.COACH;
}

@Controller("wods")
export class WodsController {
  constructor(private readonly wodsService: WodsService) {}

  @Get()
  list(@Query() query: ListWodsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.list(query, isStaff(user));
  }

  @Get("today")
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.today(isStaff(user));
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.findOne(id, isStaff(user));
  }

  @Roles(Role.ADMIN, Role.COACH)
  @Post()
  create(@Body() dto: CreateWodDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateWodDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @HttpCode(HttpStatus.OK)
  @Patch(":id/publish")
  publish(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.setStatus(id, "PUBLISHED", user.sub);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @HttpCode(HttpStatus.OK)
  @Patch(":id/unpublish")
  unpublish(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.setStatus(id, "DRAFT", user.sub);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @HttpCode(HttpStatus.OK)
  @Patch(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.wodsService.setStatus(id, "ARCHIVED", user.sub);
  }
}
