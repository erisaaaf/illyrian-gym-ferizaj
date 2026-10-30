import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: string;
  /** The account was created by the gym and still has its temporary password. */
  mustChangePassword?: boolean;
}

/** Injects the authenticated user's JWT payload. Never trust client-sent user IDs/roles - always read from here. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
