import { Module } from "@nestjs/common";
import { WodsController } from "./wods.controller";
import { WodsService } from "./wods.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [WodsController],
  providers: [WodsService, AuditService],
})
export class WodsModule {}
