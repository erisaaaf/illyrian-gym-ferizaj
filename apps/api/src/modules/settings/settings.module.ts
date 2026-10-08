import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, AuditService],
})
export class SettingsModule {}
