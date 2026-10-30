import { Module } from "@nestjs/common";
import { MembershipPlansController, PromotionsController } from "./membership-plans.controller";
import { MembershipsController } from "./memberships.controller";
import { MembershipsService } from "./memberships.service";
import { MembershipRequestsService } from "./membership-requests.service";
import { FinanceModule } from "../finance/finance.module";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  imports: [FinanceModule],
  controllers: [MembershipPlansController, PromotionsController, MembershipsController],
  providers: [MembershipsService, MembershipRequestsService, AuditService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
