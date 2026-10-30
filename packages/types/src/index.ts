// Shared types consumed by the mobile app and admin dashboard. These are
// hand-written mirrors of the Prisma schema (packages/database) rather than
// importing @prisma/client directly, because client apps must never bundle
// the Prisma runtime or be coupled to database internals. Grows module by
// module alongside the API - see docs/architecture.md.

// Plain string-literal unions (not TS `enum`) so they stay structurally
// assignable to the equivalent types Prisma generates (packages/database),
// which are also literal unions, not nominal enums.
export type Role = "MEMBER" | "COACH" | "RECEPTIONIST" | "ADMIN";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  profileImageUrl: string | null;
  /** True for accounts created by the gym until the person sets their own password. */
  mustChangePassword?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// Consistent error envelope returned by every API error response.
// See apps/api/src/common/filters/all-exceptions.filter.ts.
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  /** Machine-readable reason for a few cases clients must react to, e.g. PASSWORD_CHANGE_REQUIRED. */
  code?: string;
  errors?: Record<string, string[]>;
  requestId: string;
  timestamp: string;
  path: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
