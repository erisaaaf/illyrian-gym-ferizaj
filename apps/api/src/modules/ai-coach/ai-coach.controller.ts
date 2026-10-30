import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AiCoachService } from "./ai-coach.service";
import { SendMessageDto } from "./dto/send-message.dto";

// Always scoped to the caller: there is no way to address another member's conversation.
// Abuse is bounded by the per-member daily message cap (AI_RATE_LIMIT_PER_USER_PER_DAY), not per-IP,
// because many members share the gym's wifi address.
@Controller("ai-coach")
export class AiCoachController {
  constructor(private readonly aiCoach: AiCoachService) {}

  @Get("conversation")
  latest(@CurrentUser() user: AuthenticatedUser) {
    return this.aiCoach.latest(user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Post("messages")
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.aiCoach.send(user.sub, dto);
  }
}
