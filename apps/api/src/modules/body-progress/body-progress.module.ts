import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { BodyPhotoImageController, BodyProgressController, SharedBodyController } from "./body-progress.controller";
import { BodyProgressService } from "./body-progress.service";

@Module({
  controllers: [BodyProgressController, BodyPhotoImageController, SharedBodyController],
  providers: [BodyProgressService, AuditService],
})
export class BodyProgressModule {}
