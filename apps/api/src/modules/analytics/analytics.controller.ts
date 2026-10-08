import { Controller, Get } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { AnalyticsService } from "./analytics.service";

@Roles(Role.ADMIN, Role.COACH)
@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  overview() {
    return this.analyticsService.overview();
  }
}
