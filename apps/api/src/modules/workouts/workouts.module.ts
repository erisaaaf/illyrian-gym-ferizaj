import { Module } from "@nestjs/common";
import { WorkoutsController } from "./workouts.controller";
import { WorkoutsService } from "./workouts.service";
import { PrsModule } from "../prs/prs.module";

@Module({
  imports: [PrsModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}
