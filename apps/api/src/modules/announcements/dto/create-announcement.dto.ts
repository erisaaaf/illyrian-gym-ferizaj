import { IsDateString, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @IsDateString()
  publishAt?: string;
}
