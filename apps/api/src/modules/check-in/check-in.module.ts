import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { CheckInController } from "./check-in.controller";
import { CheckInService } from "./check-in.service";

@Module({
  controllers: [CheckInController],
  providers: [CheckInService, AuditService],
  exports: [CheckInService],
})
export class CheckInModule {}
