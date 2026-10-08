-- CreateTable
CREATE TABLE "GymSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymSettings_pkey" PRIMARY KEY ("id")
);
