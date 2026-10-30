import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { MembershipsService } from "./memberships.service";
import { CreateMembershipPlanDto } from "./dto/create-membership-plan.dto";
import { UpdateMembershipPlanDto } from "./dto/update-membership-plan.dto";
import { CreatePromotionDto, UpdatePromotionDto } from "./dto/memberships.dto";

@Controller("membership-plans")
export class MembershipPlansController {
  constructor(private readonly memberships: MembershipsService) {}

  // Any signed-in user may read the catalog (the assignment form, the member's renewal screen).
  @Get()
  list() {
    return this.memberships.listPlans();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateMembershipPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.createPlan(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.updatePlan(id, dto, user.sub);
  }
}

/** Promotional discounts the front desk can apply when selling a membership. Only the owner creates them. */
@Controller("promotions")
export class PromotionsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get()
  list() {
    return this.memberships.listPromotions(false);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePromotionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.createPromotion(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.memberships.updatePromotion(id, dto, user.sub);
  }
}
