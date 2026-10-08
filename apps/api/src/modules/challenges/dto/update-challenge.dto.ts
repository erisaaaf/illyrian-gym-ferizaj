import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional } from "class-validator";
import { CreateChallengeDto } from "./create-challenge.dto";

const STATUSES = ["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"] as const;

export class UpdateChallengeDto extends PartialType(CreateChallengeDto) {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
