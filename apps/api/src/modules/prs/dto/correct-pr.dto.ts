import { IsDateString, IsPositive, IsString, MaxLength, MinLength } from "class-validator";

export class CorrectPrDto {
  @IsPositive()
  value!: number;

  @IsDateString()
  achievedAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
