import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";

export class UpdateMembershipDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(["PAID", "UNPAID", "PARTIAL"])
  paymentStatus?: "PAID" | "UNPAID" | "PARTIAL";
}
