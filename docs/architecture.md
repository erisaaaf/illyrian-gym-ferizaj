# Architecture

## Overview

Illyrian Gym Ferizaj is a modular monorepo (npm workspaces) with three
applications sharing two internal packages:

```
illyrian-gym-ferizaj/
├── apps/
│   ├── api/       NestJS + TypeScript REST API (source of truth)
│   ├── admin/     Next.js coach/admin dashboard
│   └── mobile/    Expo (React Native) member app
├── packages/
│   ├── database/  Prisma schema + generated client, shared by apps/api
│   ├── types/     Hand-written DTOs/enums shared by admin + mobile (no Prisma dependency)
│   └── config/    Shared design tokens (colors, spacing, typography)
├── docs/
└── tests/         Cross-cutting integration/e2e scenarios (see docs/testing.md)
```

`apps/api` is the only thing that talks to PostgreSQL. `apps/admin` and
`apps/mobile` only ever talk to the API over HTTPS - see "Data source rule"
below.

## Why this stack

- **NestJS** for the API: opinionated module system maps cleanly onto the
  spec's domain modules (auth, users, memberships, classes, bookings, wods,
  exercises, workouts, prs, attendance, challenges, achievements,
  notifications, announcements, ai, analytics, audit), built-in DI makes
  guards/interceptors/filters consistent across all of them, and
  `class-validator` gives declarative request validation.
- **Prisma + PostgreSQL**: relational integrity (foreign keys, unique
  constraints, transactions) is required for booking capacity and the PR
  engine - see docs/database.md. Prisma's generated types keep the schema
  and TypeScript in sync.
- **Next.js** for admin, **Expo** for mobile: both listed as the preferred
  stack in the product spec; Expo also gives a path to push notifications
  (FCM) and native modules (future: Apple/Google Health) without ejecting.
- **npm workspaces** instead of pnpm/turborepo: zero extra tooling to
  install and it's enough for this repo's size; revisit only if build times
  become a real problem.

## Data source rule

The PostgreSQL database (via `apps/api`) is the single source of truth for
every piece of business data - memberships, classes, bookings, WODs,
exercises, workouts, PRs, attendance, challenges, achievements. Neither
`apps/admin` nor `apps/mobile` may hold authoritative state client-side
beyond what's needed for optimistic UI; every business rule (booking
capacity, PR comparison, membership validity) is enforced server-side.
Client-submitted user IDs, roles, and PR values are never trusted (see
`common/decorators/current-user.decorator.ts` and `common/guards/roles.guard.ts`).

## RBAC

Three roles - `MEMBER`, `COACH`, `ADMIN` - stored on `User.role`
(packages/database/prisma/schema.prisma). Enforcement is server-side only:

- `JwtAuthGuard` (apps/api/src/common/guards/jwt-auth.guard.ts) is the
  **global default guard** - every route requires a valid access token
  unless explicitly annotated `@Public()`. This makes "forgot to protect a
  new route" structurally impossible.
- `RolesGuard` (apps/api/src/common/guards/roles.guard.ts) enforces
  `@Roles(Role.ADMIN, ...)` on top of that.
- `@CurrentUser()` reads the authenticated user from the verified JWT, never
  from the request body/params - a client can never impersonate another
  user by passing a different `userId`.

## Authentication

- Passwords hashed with bcrypt (`BCRYPT_SALT_ROUNDS`, default 12).
- Access tokens: short-lived JWTs (default 15m), signed with
  `JWT_ACCESS_SECRET`.
- Refresh tokens: opaque random tokens (not JWTs), stored **hashed**
  (SHA-256) in `RefreshToken`, rotated on every use (old one revoked,
  new one issued) - see `AuthService.refresh`. A database leak alone can
  never be replayed as a usable token.
- Password reset / email verification: same opaque-token-hashed-at-rest
  pattern, single use, short TTL.
- Login errors are intentionally generic ("Invalid email or password") to
  avoid account enumeration; `forgotPassword` always responds successfully
  regardless of whether the email exists.
- Rate limiting: `@nestjs/throttler`, global default plus a stricter
  5-requests/minute throttle on `/auth/*` endpoints.

## Error handling & observability

- `AllExceptionsFilter` normalizes every error response to the
  `ApiErrorResponse` shape in `packages/types` - consistent
  `{statusCode, message, errors?, requestId, timestamp, path}` for every
  client. Unexpected errors are logged with full detail server-side and
  never leak a stack trace to the client.
- `RequestIdMiddleware` stamps every request with an `x-request-id`
  (echoed back in the response header), threaded through logs and error
  responses so a single request can be traced end-to-end.
- `StructuredLogger` emits JSON lines (`{timestamp, level, context,
  message, ...meta}`) instead of free text, so a log aggregator can query
  by field. Never logs secrets/tokens/full request bodies.
- `GET /health` (liveness) and `GET /health/ready` (checks the database
  connection) are provided for container orchestration / uptime checks.

## Open decisions (need real business input - do not guess)

These are deliberately left as configuration/TODOs rather than invented:

- **Payment provider**: no online payments are implemented yet (spec
  section 38 says not to add these unless requested). `MembershipPlan`
  has a nullable `priceCents` so pricing can be added later without a
  schema change.
- **Email provider**: `apps/api/src/common/mailer/mailer.service.ts` logs
  emails instead of sending them until `EMAIL_PROVIDER` is set and a real
  provider (Resend/Postmark/SES) is wired in.
- **File storage** (profile photos, announcement images, coach photos):
  env vars are defined (`STORAGE_PROVIDER`, `CLOUDINARY_URL`, or S3
  credentials) but no upload code exists yet - added when the first
  feature needs it.
- **Real class schedule, coach bios/certifications, membership prices,
  official gym policies, branding assets**: none of this is invented
  anywhere in the codebase. Seed data (packages/database/prisma/seed.ts)
  is explicitly fake/development-only and must never be used in
  production - see spec section 67/79.

## AI Coach

`apps/api/src/modules/ai-coach`. A member talks to the assistant through
`POST /ai-coach/messages`; the latest chat is restored with
`GET /ai-coach/conversation`. Both are scoped to the caller - there is no route
that addresses another member's conversation. History is stored in
`AIConversation` / `AIMessage`.

- **Grounded in real data only.** For every message the API builds a context
  from the database: first name, membership, today's *published* WOD, PRs,
  recent workouts, progress summary and upcoming bookings. The model is told to
  use only that, never to invent workouts/PRs/prices/schedules, and not to give
  medical advice.
- **Provider abstraction.** `OpenAiCoachProvider` is used when `OPENAI_API_KEY`
  is set. Otherwise `LocalCoachProvider` answers a fixed set of intents (WOD,
  PRs, progress, classes, membership, recent workouts) straight from the same
  context. It is not a language model and the app says so ("Basic mode"). If
  OpenAI errors, the request falls back to the local provider and the response
  reports which engine answered (`provider: "openai" | "local"`).
- **Safety.** Questions about pain, injury, illness or medication get a
  fixed "I'm not a medical professional" answer instead of advice.
- **Cost / abuse control.** `AI_RATE_LIMIT_PER_USER_PER_DAY` messages per member
  per rolling 24h (HTTP 429 after that), `AI_MAX_OUTPUT_TOKENS`, input capped at
  1000 characters. The limit is per member, not per IP, because members share the
  gym's wifi address.

## Gym time

"Today" is decided by `GYM_TIMEZONE` (default `Europe/Belgrade`), not the
server's clock. A WOD date is a date-only value stored as UTC midnight of the gym's
calendar day; `GET /wods/today`, training streaks and the weekly training-days
chart all use `apps/api/src/common/gym-time.ts`.

## Ownership rules

A trainer only manages classes assigned to them: participants, check-in and the
attendance list are limited to their own classes (`common/class-access.ts`);
admins can manage any class. Attendance records who marked it (`markedBy`) and
corrections keep the booking status in step in both directions, so a mistake can
always be undone.

## Phased build plan

Following the spec's phase ordering (section 70):

1. **Foundation** (this session): repo, database schema, Prisma, env
   config, auth, RBAC, design tokens, logging/error-handling foundation.
2. **Gym core**: memberships, classes, booking (with capacity
   concurrency), WODs, exercise library, Home screen.
3. **Training**: workout tracking, history, progress.
4. **PR engine**: automatic detection, history, verification, correction,
   concurrency-safe updates, audit logging.
5. **AI Assistant Coach** (done): context retrieval, chat, safety behavior, cost
   controls - see [AI Coach](#ai-coach).
6. **Admin dashboard** screens for all of the above.
7. **Engagement**: notifications, challenges, achievements, leaderboards.
8. **Production hardening**: security/perf/accessibility/backup review.

See docs/database.md, docs/testing.md for schema and testing details.
