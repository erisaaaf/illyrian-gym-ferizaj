import { IsIn } from "class-validator";

export class SetMemberStatusDto {
  @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"])
  status!: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}
