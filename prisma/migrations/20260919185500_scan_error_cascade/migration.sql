-- AlterTable
ALTER TABLE "Scan" ADD COLUMN "errorMessage" TEXT;

-- CreateIndex
CREATE INDEX "Scan_userId_idx" ON "Scan"("userId");
