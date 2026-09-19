/*
  Warnings:

  - You are about to drop the column `mappedinMapId` on the `Scan` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "metadata" TEXT NOT NULL,
    "photoKeys" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "modelUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Scan" ("city", "country", "createdAt", "id", "lat", "lng", "metadata", "modelUrl", "photoKeys", "role", "state", "status", "street", "updatedAt", "userId") SELECT "city", "country", "createdAt", "id", "lat", "lng", "metadata", "modelUrl", "photoKeys", "role", "state", "status", "street", "updatedAt", "userId" FROM "Scan";
DROP TABLE "Scan";
ALTER TABLE "new_Scan" RENAME TO "Scan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
