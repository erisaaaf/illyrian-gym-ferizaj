import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PrsService } from "./prs.service";
import { ManualPrDto } from "./dto/manual-pr.dto";
import { CorrectPrDto } from "./dto/correct-pr.dto";
import { ListPrsQueryDto } from "./dto/list-prs.query.dto";

@Controller()
export class PrsController {
  constructor(private readonly prsService: PrsService) {}

  @Get("prs/me")
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.prsService.listMine(user.sub);
  }

  @Get("prs/me/:exerciseId/history")
  historyMine(@Param("exerciseId") exerciseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.prsService.historyMine(user.sub, exerciseId);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @Get("admin/prs")
  list(@Query() query: ListPrsQueryDto) {
    return this.prsService.list(query);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @Get("admin/prs/:id/history")
  history(@Param("id") id: string) {
    return this.prsService.history(id);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @HttpCode(HttpStatus.OK)
  @Patch("admin/prs/:id/verify")
  verify(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.prsService.verify(id, user.sub);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @HttpCode(HttpStatus.OK)
  @Patch("admin/prs/:id/correct")
  correct(@Param("id") id: string, @Body() dto: CorrectPrDto, @CurrentUser() user: AuthenticatedUser) {
    return this.prsService.correct(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.COACH)
  @Post("admin/prs/manual")
  manualAdd(@Body() dto: ManualPrDto, @CurrentUser() user: AuthenticatedUser) {
    return this.prsService.manualAdd(dto, user.sub);
  }
}
