import { IsBoolean, IsOptional } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";
import { CreateExerciseDto } from "./create-exercise.dto";

export class UpdateExerciseDto extends PartialType(CreateExerciseDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
