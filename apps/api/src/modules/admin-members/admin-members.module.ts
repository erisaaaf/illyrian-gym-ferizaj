import { Module } from "@nestjs/common";
import { AdminMembersController } from "./admin-members.controller";
import { AdminMembersService } from "./admin-members.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [AdminMembersController],
  providers: [AdminMembersService, AuditService],
})
export class AdminMembersModule {}
