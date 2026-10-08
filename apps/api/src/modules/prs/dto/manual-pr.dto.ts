import { IsDateString, IsPositive, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class ManualPrDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  exerciseId!: string;

  @IsPositive()
  value!: number;

  @IsDateString()
  achievedAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
