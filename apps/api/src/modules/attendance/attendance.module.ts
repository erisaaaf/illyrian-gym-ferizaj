import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AuditService],
})
export class AttendanceModule {}
