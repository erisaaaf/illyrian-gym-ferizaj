import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListClientsQueryDto extends PaginationQueryDto {
  /** Owner only: look at one trainer's clients. A trainer always sees just their own. */
  @IsOptional()
  @IsUUID()
  coachId?: string;
}

export class ClientReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class PlanItemDto {
  /** 1 = Monday ... 7 = Sunday */
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @IsUUID()
  exerciseId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  position?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(100)
  sets?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(1000)
  reps?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1000)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(86_400)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePlanDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  goal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsDateString()
  startsOn!: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsArray()
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  items!: PlanItemDto[];
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  goal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "COMPLETED", "ARCHIVED"])
  status?: "ACTIVE" | "COMPLETED" | "ARCHIVED";

  /** When given, replaces the whole schedule. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  items?: PlanItemDto[];
}

export class ListPlansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "COMPLETED", "ARCHIVED"])
  status?: "ACTIVE" | "COMPLETED" | "ARCHIVED";
}
