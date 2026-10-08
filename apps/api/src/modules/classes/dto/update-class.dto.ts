import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  coachId?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsIn(["SCHEDULED", "CANCELLED", "COMPLETED"])
  status?: "SCHEDULED" | "CANCELLED" | "COMPLETED";
}
