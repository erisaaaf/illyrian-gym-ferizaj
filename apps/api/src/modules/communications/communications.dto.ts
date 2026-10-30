import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

export const AUDIENCES = ["INDIVIDUAL", "ALL_ACTIVE", "EXPIRING_SOON", "EXPIRED", "UNPAID", "AT_RISK", "ASSIGNED_CLIENTS"] as const;
export const MESSAGE_TYPES = ["MESSAGE", "OFFER", "SCHEDULE_CHANGE", "MEMBERSHIP_EXPIRING"] as const;

export class MessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsIn(AUDIENCES)
  audience!: (typeof AUDIENCES)[number];

  /** Required for INDIVIDUAL. */
  @ValidateIf((o: MessageDto) => o.audience === "INDIVIDUAL")
  @IsUUID()
  userId?: string;

  /** What kind of message this is (shown in the member's inbox). */
  @IsOptional()
  @IsIn(MESSAGE_TYPES)
  type?: (typeof MESSAGE_TYPES)[number];
}

export class ListMessagesQueryDto extends PaginationQueryDto {}
