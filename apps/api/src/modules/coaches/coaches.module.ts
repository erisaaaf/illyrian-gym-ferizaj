import { Module } from "@nestjs/common";
import { CoachesController } from "./coaches.controller";
import { CoachesService } from "./coaches.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [CoachesController],
  providers: [CoachesService, AuditService],
  exports: [CoachesService],
})
export class CoachesModule {}
