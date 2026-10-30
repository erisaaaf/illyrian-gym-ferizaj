import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { AuditService } from "../../common/audit/audit.service";
import { ChallengesModule } from "../challenges/challenges.module";

@Module({
  imports: [ChallengesModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AuditService],
})
export class AttendanceModule {}
