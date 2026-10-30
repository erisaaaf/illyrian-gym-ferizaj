import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTOS_PER_MEMBER = 60;

export class CreateMeasurementDto {
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(400)
  weightKg?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(80)
  bodyFatPercent?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(300)
  chestCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(300)
  waistCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(300)
  hipsCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(5)
  @Max(150)
  armCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(200)
  thighCm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Private unless the member explicitly turns this on. */
  @IsOptional()
  @IsBoolean()
  sharedWithCoach?: boolean;
}

export class ShareDto {
  @IsBoolean()
  sharedWithCoach!: boolean;
}

export class UploadPhotoDto {
  @IsOptional()
  @IsDateString()
  takenAt?: string;

  @IsIn(["image/jpeg", "image/png", "image/webp"])
  mimeType!: "image/jpeg" | "image/png" | "image/webp";

  /** The image, base64 encoded (no data: prefix). */
  @IsString()
  @Matches(/^[A-Za-z0-9+/]+=*$/, { message: "dataBase64 must be base64" })
  @MaxLength(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 8, { message: "The photo is too large (3 MB maximum)" })
  dataBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsBoolean()
  sharedWithCoach?: boolean;
}
