import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { WorkoutsService } from "./workouts.service";
import { RecordWorkoutDto } from "./dto/record-workout.dto";

@Controller("workouts")
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  record(@Body() dto: RecordWorkoutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workoutsService.record(user.sub, dto);
  }

  @Get("me")
  listMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workoutsService.listMine(user.sub, query);
  }
}
