-- Enforce at most one active (BOOKED or WAITLISTED) booking per user per
-- class, even under concurrent requests. Prisma's schema language cannot
-- express a filtered/partial unique index, so this is hand-written - see
-- docs/database.md#booking-concurrency.
CREATE UNIQUE INDEX "booking_active_unique"
  ON "Booking" ("userId", "classId")
  WHERE "status" IN ('BOOKED', 'WAITLISTED');
