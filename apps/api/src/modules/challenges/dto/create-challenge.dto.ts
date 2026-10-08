import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateChallengeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rules?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  pointsLabel?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
