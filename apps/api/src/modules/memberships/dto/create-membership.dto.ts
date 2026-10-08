import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";

export class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  planId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsIn(["PAID", "UNPAID", "PARTIAL"])
  paymentStatus?: "PAID" | "UNPAID" | "PARTIAL";
}
