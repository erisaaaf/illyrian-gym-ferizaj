-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('GYM', 'CROSSFIT', 'COMBINED');

-- CreateEnum
CREATE TYPE "PackagePeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'CARD');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'EQUIPMENT', 'MAINTENANCE', 'UTILITIES', 'SALARIES', 'MARKETING', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitMethod" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "MembershipRequestType" AS ENUM ('RENEWAL', 'FREEZE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MessageAudience" AS ENUM ('INDIVIDUAL', 'ALL_ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'UNPAID', 'AT_RISK', 'ASSIGNED_CLIENTS');

-- CreateEnum
CREATE TYPE "WorkoutPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE 'OFFER';
ALTER TYPE "NotificationType" ADD VALUE 'SCHEDULE_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'MEMBERSHIP_FROZEN';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'RECEPTIONIST';

-- AlterTable
ALTER TABLE "GymSettings" ADD COLUMN     "atRiskLongDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "atRiskShortDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "blockUnpaidCheckIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "duplicateScanMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "expiringSoonDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "invoiceDueDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxFreezeDays" INTEGER;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountNote" TEXT,
ADD COLUMN     "frozenFrom" TIMESTAMP(3),
ADD COLUMN     "frozenUntil" TIMESTAMP(3),
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "renewedFromId" TEXT,
ADD COLUMN     "totalFrozenDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "period" "PackagePeriod" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "planType" "MembershipType" NOT NULL DEFAULT 'COMBINED',
ADD COLUMN     "services" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "assignedCoachId" TEXT,
ADD COLUMN     "memberNumber" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "membershipId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "method" "PaymentMethod" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'COMPLETED',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "spentAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "VisitMethod" NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT,
    "type" "MembershipRequestType" NOT NULL,
    "requestedFrom" TIMESTAMP(3),
    "requestedUntil" TIMESTAMP(3),
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "handledNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "notes" TEXT,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "status" "WorkoutPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "exerciseId" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "weightKg" DECIMAL(7,2),
    "durationSeconds" INTEGER,
    "notes" TEXT,

    CONSTRAINT "WorkoutPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerNote" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(5,2),
    "bodyFatPercent" DECIMAL(4,1),
    "chestCm" DECIMAL(5,1),
    "waistCm" DECIMAL(5,1),
    "hipsCm" DECIMAL(5,1),
    "armCm" DECIMAL(5,1),
    "thighCm" DECIMAL(5,1),
    "notes" TEXT,
    "sharedWithCoach" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "note" TEXT,
    "sharedWithCoach" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "audience" "MessageAudience" NOT NULL,
    "sentById" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,

    CONSTRAINT "MessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_membershipId_idx" ON "Invoice"("membershipId");

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_membershipId_idx" ON "Payment"("membershipId");

-- CreateIndex
CREATE INDEX "Payment_receivedAt_idx" ON "Payment"("receivedAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "GymVisit_userId_checkedInAt_idx" ON "GymVisit"("userId", "checkedInAt");

-- CreateIndex
CREATE INDEX "GymVisit_checkedInAt_idx" ON "GymVisit"("checkedInAt");

-- CreateIndex
CREATE INDEX "MembershipRequest_status_createdAt_idx" ON "MembershipRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MembershipRequest_userId_idx" ON "MembershipRequest"("userId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_status_idx" ON "WorkoutPlan"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkoutPlanItem_planId_weekday_idx" ON "WorkoutPlanItem"("planId", "weekday");

-- CreateIndex
CREATE INDEX "TrainerNote_memberId_createdAt_idx" ON "TrainerNote"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "BodyMeasurement_userId_measuredAt_idx" ON "BodyMeasurement"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "ProgressPhoto_userId_takenAt_idx" ON "ProgressPhoto"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MessageRecipient_userId_idx" ON "MessageRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRecipient_messageId_userId_key" ON "MessageRecipient"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberNumber_key" ON "User"("memberNumber");

-- CreateIndex
CREATE INDEX "User_assignedCoachId_idx" ON "User"("assignedCoachId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedCoachId_fkey" FOREIGN KEY ("assignedCoachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanItem" ADD CONSTRAINT "WorkoutPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanItem" ADD CONSTRAINT "WorkoutPlanItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerNote" ADD CONSTRAINT "TrainerNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Hand-written additions (not expressible in schema.prisma)
-- ============================================================================

-- Human-readable unique numbers come from database sequences, so two staff members registering a member (or
-- issuing an invoice) at the same moment can never get the same number.
CREATE SEQUENCE IF NOT EXISTS member_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Backfill: existing members receive a number in registration order, then the sequence continues after them.
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn
  FROM "User"
  WHERE role = 'MEMBER' AND "memberNumber" IS NULL
)
UPDATE "User" u
SET "memberNumber" = 'IG-' || lpad((1000 + ordered.rn)::text, 5, '0')
FROM ordered
WHERE u.id = ordered.id;

-- Continue after the highest number handed out (is_called = true means the NEXT value is max + 1).
SELECT setval('member_number_seq', GREATEST(1000 + (SELECT count(*) FROM "User" WHERE "memberNumber" IS NOT NULL), 1000), true);

-- Money and measurement sanity, enforced by the database itself.
ALTER TABLE "Payment" ADD CONSTRAINT payment_amount_positive CHECK ("amountCents" > 0);
ALTER TABLE "Expense" ADD CONSTRAINT expense_amount_positive CHECK ("amountCents" > 0);
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_amounts_valid CHECK ("subtotalCents" >= 0 AND "discountCents" >= 0 AND "totalCents" >= 0 AND "totalCents" = "subtotalCents" - "discountCents");
ALTER TABLE "Membership" ADD CONSTRAINT membership_discount_nonneg CHECK ("discountCents" >= 0);
ALTER TABLE "Promotion" ADD CONSTRAINT promotion_exactly_one_discount CHECK (("percentOff" IS NOT NULL) <> ("amountOffCents" IS NOT NULL));
ALTER TABLE "Promotion" ADD CONSTRAINT promotion_percent_range CHECK ("percentOff" IS NULL OR ("percentOff" BETWEEN 1 AND 100));
ALTER TABLE "WorkoutPlanItem" ADD CONSTRAINT plan_item_weekday_range CHECK ("weekday" BETWEEN 1 AND 7);
ALTER TABLE "GymSettings" ADD CONSTRAINT settings_thresholds_positive CHECK ("expiringSoonDays" > 0 AND "atRiskShortDays" > 0 AND "atRiskLongDays" >= "atRiskShortDays" AND "duplicateScanMinutes" >= 0 AND "invoiceDueDays" >= 0);
