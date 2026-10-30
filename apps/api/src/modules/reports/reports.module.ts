import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportsExportService } from "./reports-export.service";
import { BusinessAssistantService } from "./business-assistant.service";

@Module({
  imports: [FinanceModule, MembershipsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExportService, BusinessAssistantService],
  exports: [ReportsService],
})
export class ReportsModule {}
