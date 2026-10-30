import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { CommunicationsController } from "./communications.controller";
import { CommunicationsService } from "./communications.service";

@Module({ controllers: [CommunicationsController], providers: [CommunicationsService, AuditService] })
export class CommunicationsModule {}
