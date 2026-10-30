import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ClientsService } from "./clients.service";
import { WorkoutPlansService } from "./workout-plans.service";
import { ClientReportQueryDto, CreateNoteDto, CreatePlanDto, ListClientsQueryDto, ListPlansQueryDto, UpdatePlanDto } from "./dto/coaching.dto";

/**
 * The trainer portal. Every route is scoped on the server: a trainer reaches only the members assigned to them,
 * the owner reaches everyone, reception and members reach nothing here.
 */
@Roles(Role.ADMIN, Role.COACH)
@Controller()
export class CoachingController {
  constructor(
    private readonly clients: ClientsService,
    private readonly plans: WorkoutPlansService,
  ) {}

  // --- Clients
  @Get("clients")
  list(@Query() query: ListClientsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.list(query, user);
  }

  @Get("clients/:id")
  detail(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.detail(id, user);
  }

  @Get("clients/:id/report")
  report(@Param("id", ParseUUIDPipe) id: string, @Query() query: ClientReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.report(id, query, user);
  }

  @Post("clients/:id/notes")
  addNote(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.addNote(id, dto.body, user);
  }

  @Delete("trainer-notes/:id")
  deleteNote(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.deleteNote(id, user);
  }

  // --- Workout plans (assigned to a member; they appear in the member's app)
  @Get("workout-plans")
  listPlans(@Query() query: ListPlansQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.plans.list(query, user);
  }

  @Post("workout-plans")
  createPlan(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.plans.create(dto, user);
  }

  @Get("workout-plans/:id")
  getPlan(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.plans.findOne(id, user);
  }

  @Patch("workout-plans/:id")
  updatePlan(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.plans.update(id, dto, user);
  }
}

/** The member's side of the same records. */
@Controller()
export class MyPlansController {
  constructor(private readonly plans: WorkoutPlansService) {}

  @Get("me/workout-plans")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.plans.mine(user.sub);
  }
}
