import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { WodExerciseInputDto } from "./wod-exercise-input.dto";

const SECTION_TYPES = ["WARM_UP", "STRENGTH", "METCON", "COOLDOWN"] as const;

export class WodSectionInputDto {
  @IsIn(SECTION_TYPES)
  type!: (typeof SECTION_TYPES)[number];

  @IsInt()
  @Min(0)
  order!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => WodExerciseInputDto)
  exercises!: WodExerciseInputDto[];
}
