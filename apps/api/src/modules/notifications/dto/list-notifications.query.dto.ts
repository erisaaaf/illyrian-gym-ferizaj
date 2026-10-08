import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["true", "false"])
  unreadOnly?: "true" | "false";

  @IsOptional()
  @IsUUID()
  userId?: string;
}
