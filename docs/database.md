# Database

PostgreSQL via Prisma. Schema: `packages/database/prisma/schema.prisma`.

## Setup

```bash
# 1. Start local Postgres via Docker Compose (see docker-compose.yml)
docker compose up -d
# Host port 5434 (not 5432) - avoids clashing with any other local Postgres.
# DATABASE_URL: postgresql://illyrian:illyrian_dev_only@localhost:5434/illyrian_gym_dev
# Set it in packages/database/.env (and apps/api/.env)

# 2. Generate the Prisma client
npm run db:generate

# 3. Create and apply migrations (dev)
npm run db:migrate

# 4. Seed development data (NEVER run against production)
npm run db:seed
```

## Migrations

Every schema change goes through `prisma migrate dev --name <description>`,
never a manually-edited database. Migration files are committed
(`packages/database/prisma/migrations/`) so `prisma migrate deploy` can
reproduce the schema in staging/production from a clean database.

### Booking concurrency

Prisma cannot express a **partial/filtered unique index** natively (e.g.
"unique per user+class, but only among non-cancelled bookings"). After the
first migration is generated, a follow-up raw-SQL migration adds:

```sql
CREATE UNIQUE INDEX "booking_active_unique"
  ON "Booking" ("userId", "classId")
  WHERE "status" IN ('BOOKED', 'WAITLISTED');
```

This guarantees at the database level that a user cannot hold two
simultaneous active bookings for the same class, even under concurrent
requests, independent of the application-level check.

Class capacity is enforced with a conditional update rather than a
read-then-write race:

```sql
UPDATE "Class" SET "bookedCount" = "bookedCount" + 1
WHERE id = $1 AND "bookedCount" < capacity
```

run inside the same transaction as the `Booking` insert; if zero rows are
updated, the class is full and the transaction is rolled back. This is
implemented in the bookings module (Phase 2), not yet present in the
Phase-1 schema-only foundation.

### PR concurrency

`PersonalRecord` has a unique `(userId, exerciseId)` constraint - one "current
best" row per user per exercise. The PR engine (Phase 4) must update it
inside a transaction using a conditional `UPDATE ... WHERE value < $new`
(or `>` depending on `PrType` - see spec section 23) so two concurrent
workout submissions can never both "win" or leave the record in an
inconsistent state. `PersonalRecordHistory` is append-only and is never
updated or deleted, preserving full history regardless of how the current
record changes.

## Maintenance (not yet automated)

Revoked/expired rows in `RefreshToken`, `PasswordResetToken`, and
`EmailVerificationToken` are never deleted by the application (only
flagged via `revokedAt`/`usedAt`/`expiresAt`), so these tables grow
unboundedly over time. Before production launch, add a scheduled job
(cron/worker) that periodically deletes rows past their `expiresAt` plus a
retention window - tracked here rather than built prematurely in Phase 1.

## Cascade / deletion policy

- Users are never hard-deleted by the application; `User.deletedAt`
  supports soft deletion. Foreign keys mostly cascade (e.g.
  `RefreshToken`, `Booking`) because a genuine hard delete is an
  admin-only, rare operation - but training history
  (`PersonalRecordHistory`, `WorkoutResult`) is designed to be preserved
  regardless; deleting a user's account should anonymize rather than
  delete performance history in a future GDPR-style erasure flow.
- `Exercise` deletion is restricted (`onDelete: Restrict`) wherever it's
  referenced by historical data (`WodExercise`, `WorkoutResult`,
  `PersonalRecord`, `PersonalRecordHistory`) - exercises should be
  deactivated (`active = false`), not deleted, once they have history.

## Indexing

Indexes are placed on every foreign key used in a hot lookup path
(`userId` on user-owned tables), plus the columns queried for
scheduling/listing (`Class.startTime`, `Wod.date`,
`Notification(userId, readAt)`, `AuditLog(entityType, entityId)`). Revisit
with `EXPLAIN ANALYZE` once real query patterns exist (Phase 8 performance
review) rather than guessing further indexes now.
