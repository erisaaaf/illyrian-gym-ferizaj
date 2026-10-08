import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ExercisesService } from "./exercises.service";
import { CreateExerciseDto } from "./dto/create-exercise.dto";
import { UpdateExerciseDto } from "./dto/update-exercise.dto";
import { ListExercisesQueryDto } from "./dto/list-exercises.query.dto";

@Controller("exercises")
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  list(@Query() query: ListExercisesQueryDto) {
    return this.exercisesService.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.exercisesService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateExerciseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.exercisesService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateExerciseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.exercisesService.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/deactivate")
  deactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exercisesService.setActive(id, false, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/reactivate")
  reactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exercisesService.setActive(id, true, user.sub);
  }
}
