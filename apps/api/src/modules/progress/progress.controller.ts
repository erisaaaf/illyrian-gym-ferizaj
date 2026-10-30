import { Controller, Get } from "@nestjs/common";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ProgressService } from "./progress.service";

@Controller("progress")
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // Always the caller's own data - there is deliberately no :userId route.
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.progressService.summary(user.sub);
  }
}
