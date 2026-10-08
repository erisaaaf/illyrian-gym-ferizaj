import { IsIn, IsOptional, IsUUID } from "class-validator";
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
}
