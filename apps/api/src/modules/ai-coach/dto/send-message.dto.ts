import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
