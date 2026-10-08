import { Module } from "@nestjs/common";
import { AnnouncementsController } from "./announcements.controller";
import { AnnouncementsService } from "./announcements.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AuditService],
})
export class AnnouncementsModule {}
