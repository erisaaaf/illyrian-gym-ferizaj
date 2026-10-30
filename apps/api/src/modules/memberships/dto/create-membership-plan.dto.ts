import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from "class-validator";

export class CreateMembershipPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @IsPositive()
  durationDays!: number;

  /** What the package covers: Gym, CrossFit or Combined. */
  @IsOptional()
  @IsIn(["GYM", "CROSSFIT", "COMBINED"])
  planType?: "GYM" | "CROSSFIT" | "COMBINED";

  @IsOptional()
  @IsIn(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"])
  period?: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";

  /** Services included, as the gym words them (nothing is pre-filled). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  services?: string[];

  /** Left empty until the gym confirms pricing. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
