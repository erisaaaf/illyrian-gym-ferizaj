import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(["BOOKED", "WAITLISTED", "CANCELLED", "ATTENDED", "NO_SHOW"])
  status?: "BOOKED" | "WAITLISTED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";

  /** Class start time window (the date filter). */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Only bookings the member is still going to: active (booked/waitlisted) for classes that haven't ended. */
  @IsOptional()
  @IsIn(["true", "false"])
  upcoming?: "true" | "false";
}
