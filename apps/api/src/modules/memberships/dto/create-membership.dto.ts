import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";

const MAX_CENTS = 100_000_000;

export class InitialPaymentDto {
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  amountCents!: number;

  @IsIn(["CASH", "BANK", "CARD"])
  method!: "CASH" | "BANK" | "CARD";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

/**
 * Assigns a package to a member. In one transaction this creates the membership and - when a price is known -
 * its invoice, and (optionally) records the first payment, so the member's status, invoice and payment history
 * are consistent from the first moment.
 */
export class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  planId!: string;

  @IsDateString()
  startDate!: string;

  /** Defaults to startDate + the package's duration. */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Overrides the package price for this member (e.g. a negotiated price). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  priceCents?: number;

  /** A promotion to apply (percent or fixed amount off). */
  @IsOptional()
  @IsUUID()
  promotionId?: string;

  /** An extra individual discount on top of / instead of a promotion, in cents. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  discountCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountNote?: string;

  /** Legacy / manual: used only when no invoice is created (the price is unknown). Otherwise derived from payments. */
  @IsOptional()
  @IsIn(["PAID", "UNPAID", "PARTIAL"])
  paymentStatus?: "PAID" | "UNPAID" | "PARTIAL";

  @IsOptional()
  @IsDateString()
  invoiceDueDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPaymentDto)
  initialPayment?: InitialPaymentDto;
}
