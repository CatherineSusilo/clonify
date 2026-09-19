-- Preserve every captured level as first-class scan data instead of treating
-- a property as a single room or single floor.
ALTER TABLE "Scan" ADD COLUMN "floorCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Room" ADD COLUMN "floor" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "Room_scanId_floor_idx" ON "Room"("scanId", "floor");
