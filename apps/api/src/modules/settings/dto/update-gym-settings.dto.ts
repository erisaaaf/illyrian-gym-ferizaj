import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateGymSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
