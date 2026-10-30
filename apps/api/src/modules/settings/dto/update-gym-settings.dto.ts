import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class UpdateGymSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  // --- Operating rules. Defaults exist but are starting points to confirm with the gym, not facts.

  /** A membership ending within this many days is "Expiring Soon". */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  expiringSoonDays?: number;

  /** "At-risk" threshold: no visit in this many days (default 14). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  atRiskShortDays?: number;

  /** Second, stricter threshold (default 30). Must be at least the short one. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  atRiskLongDays?: number;

  /** A second scan of the same member within this many minutes is a duplicate (0 turns the check off). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  duplicateScanMinutes?: number;

  /** Refuse entry while the member's membership is unpaid. */
  @IsOptional()
  @IsBoolean()
  blockUnpaidCheckIn?: boolean;

  /** Maximum total frozen days per membership. null = no limit configured. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(365)
  maxFreezeDays?: number | null;

  /** Days from issue until an invoice is due (0 = due immediately). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  invoiceDueDays?: number;
}
