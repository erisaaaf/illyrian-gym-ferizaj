import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { ChallengesService } from "./challenges.service";
import { CreateChallengeDto } from "./dto/create-challenge.dto";
import { UpdateChallengeDto } from "./dto/update-challenge.dto";

@Controller("challenges")
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.challengesService.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.challengesService.findOne(id);
  }

  @Get(":id/leaderboard")
  leaderboard(@Param("id") id: string) {
    return this.challengesService.leaderboard(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(":id/join")
  join(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.challengesService.join(id, user.sub);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateChallengeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.challengesService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateChallengeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.challengesService.update(id, dto, user.sub);
  }
}
