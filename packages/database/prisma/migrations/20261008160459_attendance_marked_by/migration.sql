-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "markedAt" TIMESTAMP(3),
ADD COLUMN     "markedById" TEXT;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
