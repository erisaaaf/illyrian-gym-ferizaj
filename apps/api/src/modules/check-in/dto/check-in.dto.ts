import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

/** Exactly one of `code` (scanned QR), `memberNumber` (typed at the desk) or `userId` (picked from a search) is required. */
export class CheckInDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  memberNumber?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class ListVisitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
