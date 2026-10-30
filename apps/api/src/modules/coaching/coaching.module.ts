import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { ProgressModule } from "../progress/progress.module";
import { CoachingController, MyPlansController } from "./coaching.controller";
import { ClientsService } from "./clients.service";
import { WorkoutPlansService } from "./workout-plans.service";

@Module({
  imports: [ProgressModule],
  controllers: [CoachingController, MyPlansController],
  providers: [ClientsService, WorkoutPlansService, AuditService],
  exports: [WorkoutPlansService],
})
export class CoachingModule {}
