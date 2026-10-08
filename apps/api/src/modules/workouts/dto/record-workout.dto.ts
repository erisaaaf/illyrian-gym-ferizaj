import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from "class-validator";

export class RecordWorkoutDto {
  @IsOptional()
  @IsUUID()
  wodId?: string;

  @IsOptional()
  @IsUUID()
  exerciseId?: string;

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
  @IsPositive()
  distanceMeters?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rounds?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  calories?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
