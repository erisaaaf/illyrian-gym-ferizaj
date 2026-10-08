import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional } from "class-validator";
import { CreateWodDto } from "./create-wod.dto";

const WOD_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class UpdateWodDto extends PartialType(CreateWodDto) {
  @IsOptional()
  @IsIn(WOD_STATUSES)
  status?: (typeof WOD_STATUSES)[number];
}
