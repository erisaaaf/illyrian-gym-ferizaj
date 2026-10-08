import { Module } from "@nestjs/common";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, AuditService],
})
export class BookingsModule {}
