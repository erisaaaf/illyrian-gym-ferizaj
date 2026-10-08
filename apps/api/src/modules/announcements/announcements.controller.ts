import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { AnnouncementsService } from "./announcements.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";

@Controller("announcements")
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.list(query, user.role === Role.ADMIN || user.role === Role.COACH);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch(":id/publish")
  publish(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.setStatus(id, "PUBLISHED", user.sub);
  }

  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch(":id/unpublish")
  unpublish(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.setStatus(id, "DRAFT", user.sub);
  }

  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.setStatus(id, "ARCHIVED", user.sub);
  }
}
