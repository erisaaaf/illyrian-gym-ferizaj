import { Module } from "@nestjs/common";
import { WorkoutsController } from "./workouts.controller";
import { WorkoutsService } from "./workouts.service";
import { PrsModule } from "../prs/prs.module";
import { ChallengesModule } from "../challenges/challenges.module";

@Module({
  imports: [PrsModule, ChallengesModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}
