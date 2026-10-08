import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const CATEGORIES = ["WEIGHTLIFTING", "GYMNASTICS", "CARDIO", "BODYWEIGHT", "STRONGMAN", "MOBILITY", "OTHER"] as const;

export class ListExercisesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsIn(["true", "false"])
  active?: "true" | "false";
}
