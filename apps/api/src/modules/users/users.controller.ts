import { AllowWhilePasswordChangeRequired } from "../../common/decorators/allow-password-change.decorator";
import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // No GET /users/:id - members must never be able to fetch another
  // member's profile by guessing an ID (IDOR). Only "me" is exposed here;
  // staff access to other members' data lives behind role-gated endpoints
  // in the admin module.
  @AllowWhilePasswordChangeRequired()
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findByIdOrThrow(user.sub);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }
}
