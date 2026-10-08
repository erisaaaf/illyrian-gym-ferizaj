import { Module } from "@nestjs/common";
import { PrsController } from "./prs.controller";
import { PrsService } from "./prs.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [PrsController],
  providers: [PrsService, AuditService],
  exports: [PrsService],
})
export class PrsModule {}
