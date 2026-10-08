import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const CATEGORIES = ["WEIGHTLIFTING", "GYMNASTICS", "CARDIO", "BODYWEIGHT", "STRONGMAN", "MOBILITY", "OTHER"] as const;
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const MEASUREMENT_TYPES = ["WEIGHT", "REPS", "TIME", "DISTANCE", "ROUNDS"] as const;
const PR_TYPES = ["MAX_WEIGHT", "MAX_REPS", "FASTEST_TIME", "MAX_DISTANCE", "MAX_ROUNDS"] as const;

export class CreateExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number];

  @IsIn(MEASUREMENT_TYPES)
  measurementType!: (typeof MEASUREMENT_TYPES)[number];

  // Connects this exercise to the PR engine (docs/database.md#pr-concurrency).
  // Leave unset for exercises that shouldn't track personal records.
  @IsOptional()
  @IsIn(PR_TYPES)
  prType?: (typeof PR_TYPES)[number];
}
