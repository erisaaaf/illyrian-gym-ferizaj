import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { MembershipsService } from "./memberships.service";
import { CreateMembershipPlanDto } from "./dto/create-membership-plan.dto";
import { UpdateMembershipPlanDto } from "./dto/update-membership-plan.dto";

@Controller("membership-plans")
export class MembershipPlansController {
  constructor(private readonly membershipsService: MembershipsService) {}

  // Open to any authenticated role - needed for the admin assignment form
  // and, later, member-facing plan browsing.
  @Get()
  list() {
    return this.membershipsService.listPlans();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateMembershipPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.createPlan(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMembershipPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.updatePlan(id, dto, user.sub);
  }
}
