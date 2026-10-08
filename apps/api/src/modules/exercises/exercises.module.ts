import { Module } from "@nestjs/common";
import { ExercisesController } from "./exercises.controller";
import { ExercisesService } from "./exercises.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [ExercisesController],
  providers: [ExercisesService, AuditService],
  exports: [ExercisesService],
})
export class ExercisesModule {}
