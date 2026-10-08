import { Module } from "@nestjs/common";
import { MembershipPlansController } from "./membership-plans.controller";
import { MembershipsController } from "./memberships.controller";
import { MembershipsService } from "./memberships.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [MembershipPlansController, MembershipsController],
  providers: [MembershipsService, AuditService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
