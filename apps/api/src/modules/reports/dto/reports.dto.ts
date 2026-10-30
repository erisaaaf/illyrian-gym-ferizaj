import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class RangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MonthsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(36)
  months?: number;
}

export class AtRiskQueryDto extends PaginationQueryDto {
  /** No visit in this many days. Defaults to the gym's first at-risk threshold. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class MonthlyReportQueryDto {
  /** `YYYY-MM`, in the gym's calendar. Defaults to the current month. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month must look like 2026-10" })
  month?: string;
}

export class MonthlyReportExportQueryDto extends MonthlyReportQueryDto {
  @IsIn(["xlsx", "pdf"])
  format!: "xlsx" | "pdf";
}

export class AskBusinessAssistantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  question!: string;
}
