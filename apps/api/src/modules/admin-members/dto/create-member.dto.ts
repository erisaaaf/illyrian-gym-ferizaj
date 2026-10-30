import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateMemberDto {
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

  /** Assign a trainer at registration (Admin only; ignored for reception). */
  @IsOptional()
  @IsUUID()
  assignedCoachId?: string;

  /** Staff-only notes. Never shown to the member. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
