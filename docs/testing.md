# Testing

## Levels

- **Unit tests** (`apps/api/src/**/*.spec.ts`): business logic with all I/O
  mocked - e.g. `auth.service.spec.ts` mocks Prisma/JWT/mailer and asserts
  password hashing, duplicate-email rejection, generic login errors
  (no account enumeration), refresh-token rotation, and rejection of a
  reused/revoked refresh token. `roles.guard.spec.ts` asserts RBAC denies a
  MEMBER access to an ADMIN-only route. Run: `npm run test --workspace=apps/api`.
- **Integration/e2e tests** (`apps/api/test/*.e2e-spec.ts`): boot the real
  Nest application (real guards, pipes, filters) against a **real test
  database** and drive it over HTTP with supertest -
  `auth.e2e-spec.ts` covers register → duplicate rejection → wrong-password
  rejection → login → `/users/me` requires auth → refresh rotation → reused
  refresh token rejected. Requires `DATABASE_URL` pointed at a disposable
  Postgres with migrations applied:
  ```bash
  npm run db:migrate:deploy
  npm run test:e2e --workspace=apps/api
  ```
- `account-workflow.e2e-spec.ts` covers the real account workflow: Admin logs in
  -> adds a trainer -> trainer logs in with the generated credentials; Admin adds a
  member and assigns a membership -> member logs in and books; RBAC (a trainer
  can't do admin things, a member can't see staff data); deactivation cutting
  off a live token, login and refresh immediately; admin password reset;
  public registration refused. Both e2e suites delete the rows they create.
- **Critical end-to-end member flow** (spec section 58): register → login →
  view class → book → view WOD → record workout → receive PR → view PR
  history. Only the auth portion of this exists as of Phase 1; the rest is
  added alongside the corresponding feature in Phases 2-4 rather than
  written against endpoints that don't exist yet (see spec section 72 - no
  fake functionality).

## What to test as each phase lands

- **Booking** (Phase 2): valid booking, duplicate booking, full class,
  expired membership, cancelled class, cancellation, concurrent booking
  attempts (two simultaneous requests against a class with 1 remaining
  spot - exactly one must succeed), unauthorized booking, invalid class ID.
- **PR engine** (Phase 4): first result creates a PR; a better result
  creates a new PR + history entry; a worse result does not replace it; an
  equal result is handled explicitly (documented, not accidental); each of
  the five `PrType`s compares correctly (lower-is-better for
  `FASTEST_TIME`, higher-is-better for the rest); history is never
  destroyed; two concurrent submissions never both "win"; coach
  verification and manual correction are audited.
- **Security** (ongoing, formal pass in Phase 8): IDOR (a MEMBER cannot
  fetch another member's data - there is deliberately no `GET /users/:id`,
  only `/users/me`), role escalation, invalid/expired/revoked tokens,
  rate-limit bypass, sensitive data leakage in error responses.

## Conventions

- Unit tests mock all external I/O (Prisma, JWT, mailer) - no network, no
  real database.
- e2e tests use a **separate test database**, never the dev database
  (running `npm run test:e2e` truncates/writes real rows). Never point
  `DATABASE_URL` at a database you care about when running tests.
- Test users/passwords in e2e specs are randomly suffixed
  (`e2e-${Date.now()}@...`) so re-runs don't collide on the unique email
  constraint.
