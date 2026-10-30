import { Controller, Get } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { AnalyticsService } from "./analytics.service";

// Business figures are for the owner only (trainers and reception use their own focused views).
@Roles(Role.ADMIN)
@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  overview() {
    return this.analyticsService.overview();
  }
}
