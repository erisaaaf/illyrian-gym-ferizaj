import { IsDateString, IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const WOD_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class ListWodsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(WOD_STATUSES)
  status?: (typeof WOD_STATUSES)[number];
}
