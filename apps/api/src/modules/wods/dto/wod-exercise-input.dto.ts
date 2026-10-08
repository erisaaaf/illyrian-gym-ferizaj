import { IsInt, IsOptional, IsPositive, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class WodExerciseInputDto {
  @IsUUID()
  exerciseId!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sets?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  reps?: number;

  @IsOptional()
  @IsPositive()
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  durationSeconds?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  restSeconds?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rounds?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  timeCapSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  scalingNotes?: string;
}
