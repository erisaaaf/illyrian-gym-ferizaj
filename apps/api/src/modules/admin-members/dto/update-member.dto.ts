import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator";

export class UpdateMemberDto {
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

  /** Staff-only notes ("" clears them). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;

  /** The assigned trainer; `null` unassigns. Admin only. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  assignedCoachId?: string | null;
}
