import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function buildContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows the request when no roles are required", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: "MEMBER" }))).toBe(true);
  });

  it("allows a user whose role is in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN", "COACH"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: "COACH" }))).toBe(true);
  });

  it("blocks a MEMBER from an ADMIN-only route (no privilege escalation)", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext({ role: "MEMBER" }))).toThrow(ForbiddenException);
  });

  it("blocks a request with no authenticated user", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
