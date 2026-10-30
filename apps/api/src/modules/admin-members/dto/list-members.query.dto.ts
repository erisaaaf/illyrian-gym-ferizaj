import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

/** The member categories from the requirements: Active, Expired, New, Unpaid, Inactive (+ the ones the front desk needs). */
export const MEMBER_CATEGORIES = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "FROZEN", "NEW", "UNPAID", "INACTIVE", "AT_RISK", "NO_MEMBERSHIP"] as const;

export class ListMembersQueryDto extends PaginationQueryDto {
  /** Account status. */
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"])
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";

  @IsOptional()
  @IsIn(MEMBER_CATEGORIES)
  category?: (typeof MEMBER_CATEGORIES)[number];

  @IsOptional()
  @IsUUID()
  coachId?: string;

  /** For category AT_RISK: no visit in this many days. Defaults to the gym's short threshold (14). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  atRiskDays?: number;
}
