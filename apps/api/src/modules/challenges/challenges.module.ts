import { Module } from "@nestjs/common";
import { ChallengesController } from "./challenges.controller";
import { ChallengesService } from "./challenges.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [ChallengesController],
  providers: [ChallengesService, AuditService],
})
export class ChallengesModule {}
