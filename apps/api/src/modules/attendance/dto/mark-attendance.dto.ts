import { IsIn, IsOptional, IsUUID } from "class-validator";

export class MarkAttendanceDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsIn(["CHECKED_IN", "NO_SHOW", "CANCELLED"])
  status?: "CHECKED_IN" | "NO_SHOW" | "CANCELLED";
}
