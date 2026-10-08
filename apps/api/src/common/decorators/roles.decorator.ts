import { SetMetadata } from "@nestjs/common";
import { Role } from "@illyrian/database";

export const ROLES_KEY = "roles";

/** Restricts a route to the given roles. Server-side authoritative RBAC. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
