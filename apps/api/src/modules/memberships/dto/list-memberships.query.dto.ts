import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListMembershipsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["ACTIVE", "EXPIRING_SOON", "EXPIRED", "CANCELLED"])
  status?: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED";
}
