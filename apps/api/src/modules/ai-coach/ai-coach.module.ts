import { Module } from "@nestjs/common";
import { ProgressModule } from "../progress/progress.module";
import { AiCoachController } from "./ai-coach.controller";
import { AiCoachService } from "./ai-coach.service";

@Module({
  imports: [ProgressModule],
  controllers: [AiCoachController],
  providers: [AiCoachService],
})
export class AiCoachModule {}
