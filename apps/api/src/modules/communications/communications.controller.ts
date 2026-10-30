import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { CommunicationsService } from "./communications.service";
import { ListMessagesQueryDto, MessageDto } from "./communications.dto";

// Which audiences a role may reach is enforced in the service (a trainer reaches only their own clients).
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.COACH)
@Controller("messages")
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @HttpCode(HttpStatus.OK)
  @Post("preview")
  preview(@Body() dto: MessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.communications.preview(dto, user);
  }

  @Post()
  send(@Body() dto: MessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.communications.send(dto, user);
  }

  @Get()
  history(@Query() query: ListMessagesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.communications.history(query, user);
  }

  @Get(":id")
  detail(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.communications.detail(id, user);
  }
}
