import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListMembershipsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["ACTIVE", "EXPIRING_SOON", "EXPIRED", "FROZEN", "CANCELLED"])
  status?: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "FROZEN" | "CANCELLED";

  /** One member's memberships, latest first. */
  @IsOptional()
  @IsUUID()
  userId?: string;
}
