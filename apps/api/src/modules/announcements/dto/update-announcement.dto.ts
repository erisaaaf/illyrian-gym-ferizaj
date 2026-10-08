import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional } from "class-validator";
import { CreateAnnouncementDto } from "./create-announcement.dto";

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
