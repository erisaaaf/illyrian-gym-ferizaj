import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";

@Module({ controllers: [StaffController], providers: [StaffService, AuditService] })
export class StaffModule {}
