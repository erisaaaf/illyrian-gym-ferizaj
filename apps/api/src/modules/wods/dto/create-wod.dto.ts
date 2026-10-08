import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { WodSectionInputDto } from "./wod-section-input.dto";

const WOD_TYPES = ["AMRAP", "FOR_TIME", "EMOM", "TABATA", "STRENGTH", "CUSTOM"] as const;

export class CreateWodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsDateString()
  date!: string;

  @IsIn(WOD_TYPES)
  type!: (typeof WOD_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WodSectionInputDto)
  sections!: WodSectionInputDto[];
}
