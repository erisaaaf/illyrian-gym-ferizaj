import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ClassesService } from "./classes.service";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { ListClassesQueryDto } from "./dto/list-classes.query.dto";

@Controller("classes")
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  // Open to any authenticated role - members browse the schedule too.
  @Get()
  list(@Query() query: ListClassesQueryDto) {
    return this.classesService.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.classesService.findOne(id);
  }

  // Participant names are only for staff running the class.
  @Roles(Role.ADMIN, Role.COACH)
  @Get(":id/participants")
  participants(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classesService.participants(id, user);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateClassDto, @CurrentUser() user: AuthenticatedUser) {
    return this.classesService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClassDto, @CurrentUser() user: AuthenticatedUser) {
    return this.classesService.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classesService.cancel(id, user.sub);
  }
}
