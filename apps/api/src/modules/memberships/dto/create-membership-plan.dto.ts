import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from "class-validator";

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

  // Nullable/optional on purpose - real Illyrian Gym pricing has not been
  // provided. Leave unset until authorized staff enters it (see spec
  // section 4/38 - never invent prices).
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
