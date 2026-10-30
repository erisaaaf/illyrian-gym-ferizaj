import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class SetStaffStatusDto {
  @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"])
  status!: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}
