import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListPrsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @IsOptional()
  @IsIn(["UNVERIFIED", "VERIFIED"])
  verificationStatus?: "UNVERIFIED" | "VERIFIED";
}
