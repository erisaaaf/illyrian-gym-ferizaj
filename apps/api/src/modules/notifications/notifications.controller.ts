import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";
import { ListNotificationsQueryDto } from "./dto/list-notifications.query.dto";

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("notifications/me")
  listMine(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listMine(user.sub, query);
  }

  @HttpCode(HttpStatus.OK)
  @Patch("notifications/me/:id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Patch("notifications/me/read-all")
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Roles(Role.ADMIN)
  @Get("admin/notifications")
  list(@Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.list(query);
  }
}
