import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import { InitialPaymentDto } from "./create-membership.dto";

const MAX_CENTS = 100_000_000;

export class RenewMembershipDto {
  /** Defaults to the membership's current package. */
  @IsOptional()
  @IsUUID()
  planId?: string;

  /** Defaults to the day the current membership ends (so there is no gap and no overlap), or today if it already ended. */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  priceCents?: number;

  @IsOptional()
  @IsUUID()
  promotionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  discountCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountNote?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPaymentDto)
  initialPayment?: InitialPaymentDto;
}

export class FreezeMembershipDto {
  /** Defaults to now. */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsDateString()
  until!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class UnfreezeMembershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ListExpiringQueryDto extends PaginationQueryDto {
  /** Memberships ending within this many days. Defaults to the gym's "expiring soon" setting. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class CreatePromotionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  amountOffCents?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMembershipRequestDto {
  @IsIn(["RENEWAL", "FREEZE"])
  type!: "RENEWAL" | "FREEZE";

  /** For a freeze: the period the member asks for. */
  @IsOptional()
  @IsDateString()
  requestedFrom?: string;

  @IsOptional()
  @IsDateString()
  requestedUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class HandleRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: "PENDING" | "APPROVED" | "REJECTED";
}
