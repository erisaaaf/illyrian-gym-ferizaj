import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListClassesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  coachId?: string;

  @IsOptional()
  @IsIn(["SCHEDULED", "CANCELLED", "COMPLETED"])
  status?: "SCHEDULED" | "CANCELLED" | "COMPLETED";
}
