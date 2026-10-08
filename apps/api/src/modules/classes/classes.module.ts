import { Module } from "@nestjs/common";
import { ClassesController } from "./classes.controller";
import { ClassesService } from "./classes.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [ClassesController],
  providers: [ClassesService, AuditService],
  exports: [ClassesService],
})
export class ClassesModule {}
