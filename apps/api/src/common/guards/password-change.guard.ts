import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED } from "../decorators/allow-password-change.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Activation by invitation (requirements 1): an account the gym created starts with a temporary password.
 * Until the person sets their own, the API refuses every request except the ones marked
 * @AllowWhilePasswordChangeRequired. Enforced here, on the server - the apps merely show the change-password screen.
 * Runs after JwtAuthGuard, which attaches the user.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const user = context.switchToHttp().getRequest().user as { mustChangePassword?: boolean } | undefined;
    if (!user?.mustChangePassword) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED, targets)) return true;

    throw new ForbiddenException({ message: "You must set a new password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" });
  }
}
