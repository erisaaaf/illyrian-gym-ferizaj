import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  coachId?: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsInt()
  @IsPositive()
  capacity!: number;
}
