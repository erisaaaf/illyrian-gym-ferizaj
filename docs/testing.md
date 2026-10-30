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
- `admin-management.e2e-spec.ts` exercises every Admin action over HTTP and then
  reads the result back **from the database**: trainer and member edits, password
  reset, membership edit/cancel/plans, class create/edit/capacity rules/cancel,
  booking filters and admin cancel with waitlist promotion, exercise lifecycle
  (inactive exercises hidden from members), WOD draft/publish/archive and member
  visibility, announcements, challenges (join, points, leaderboard, closed when
  completed), attendance mark/correct/undo, PR manual add/verify/correct/history,
  live analytics counts, notification log and gym settings - plus audit-log
  entries for the sensitive ones.
- `member-flow.e2e-spec.ts` is the member experience: membership, today's WOD
  (never a draft), booking/duplicate/cancel/rebook, expired membership, past
  classes, waitlist promotion, workouts -> PR detection (higher-is-better and
  lower-is-better), PR history, privacy between members, progress, notifications,
  password change. It includes the **concurrency** guarantees:
  8 members racing for 3 spots (exactly 3 booked, never over capacity), the same
  member double-submitting (one booking), and 6 simultaneous PR submissions
  (one PR holding the maximum, a strictly increasing history chain).
- `trainer-flow.e2e-spec.ts`: a trainer sees and checks in only their own class,
  is refused a colleague's, earns challenge points once per class, writes and
  publishes WODs, manually adds/verifies/corrects PRs (audited), and cannot reach
  any admin-only route.
- `cors.spec.ts` (unit): the CORS rule - the native app (no Origin) is always allowed, LAN/loopback
  origins only in development, and production/staging accept only the explicit allow-list.
- `ai-coach.e2e-spec.ts`: answers come from the member's own data, empty data is
  reported honestly, no medical advice, per-member conversations, input
  validation and the daily limit. It forces the local provider so tests never
  call a real AI vendor.
- `finance.e2e-spec.ts` (20 tests): money in integer cents; selling a membership issues a uniquely numbered
  invoice (with promotions and discounts recorded); a first payment in the same transaction; partial and full
  payments update the status and notify the member; over-payment and wrong-member payments refused;
  **concurrency: simultaneous payments can never exceed the invoice total**; reception can record but only
  the owner can void or correct, with a mandatory reason and before/after history; Pending / Partial / Paid /
  Overdue derived from the money and the due date; the member's own billing and invoice PDF; expenses;
  **revenue counts money received, never invoices**; filters by method and package; owner-only reports and
  real Excel/PDF exports.
- `front-desk.e2e-spec.ts` (37 tests): the receptionist role (created by the owner, one-time password, what
  it can and cannot do); sequential member numbers; the member categories; staff notes and what each role
  sees of a member; plan types and renewal (linked, starts when the current one ends, once only); freezing
  (end date moves, entry blocked, configurable limit); member renewal / freeze requests handled by staff;
  the expiring list; QR check-in (valid, member number, duplicate window, **five scanners at once record one
  visit**, expired / not started / cancelled / suspended refusals, forged and replaced codes, optional
  pay-before-entry rule); gym rules; at-risk members; dashboard figures that agree with the records;
  attendance statistics and busiest hour; membership growth; trainer workload; the monthly report and exports;
  the Business assistant (English and Albanian, owner-only).
- `coaching.e2e-spec.ts` (22 tests): a trainer reaches only assigned clients (404, not 403, for others); a
  plan a trainer writes appears in the member's account with today's session and adherence; notes;
  the progress report from real data; **body measurements and photos are private by default** - only the
  member, or the assigned trainer for items the member shared (never the owner, never another trainer);
  image validation (magic bytes, type mismatch, size); the communication centre (audience permissions per
  role, preview, in-app delivery, real read counts); schedule-change notices.
- All e2e suites delete the rows they create. They share one database and assert
  some global counts, so `jest-e2e.json` runs them serially (`maxWorkers: 1`,
  about a minute in total).

## Current results

Last full run: **63 unit tests (8 suites) and 191 e2e tests (9 suites), all passing**
(`npm run test --workspace=apps/api` and `npm run test:e2e --workspace=apps/api`), plus TypeScript
`--noEmit` on `apps/api`, `apps/admin` and `apps/mobile`.

UI verification was done by hand in a real browser (staff web at desktop and 375 px width, member app through
Expo web) as the owner, receptionist, trainer and member demo accounts. There are no automated browser tests
yet; see the checklist for what that means for each screen.

## What to test as each phase lands

- **Booking** (done, `member-flow`): valid booking, duplicate booking, full class,
  expired membership, cancelled class, cancellation, concurrent booking
  attempts (two simultaneous requests against a class with 1 remaining
  spot - exactly one must succeed), unauthorized booking, invalid class ID.
- **PR engine** (done, `member-flow` + `pr-engine.spec`): first result creates a PR; a better result
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
