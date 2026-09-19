-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "photoKeys" TEXT NOT NULL DEFAULT '[]',
    "panoramaKey" TEXT,
    "connections" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("category", "connections", "createdAt", "floor", "id", "name", "panoramaKey", "photoKeys", "scanId", "updatedAt") SELECT "category", "connections", "createdAt", "floor", "id", "name", "panoramaKey", "photoKeys", "scanId", "updatedAt" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE INDEX "Room_scanId_floor_idx" ON "Room"("scanId", "floor");
CREATE TABLE "new_Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "placeTitle" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "metadata" TEXT NOT NULL,
    "floorCount" INTEGER NOT NULL DEFAULT 1,
    "photoKeys" TEXT NOT NULL,
    "panoramaKey" TEXT,
    "referenceImages" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "modelUrl" TEXT,
    "isPublicBuilding" BOOLEAN NOT NULL DEFAULT false,
    "blueprintSource" TEXT,
    "publicBlueprints" TEXT NOT NULL DEFAULT '[]',
    "imageAnalysis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Scan" ("blueprintSource", "city", "country", "createdAt", "errorMessage", "floorCount", "id", "isPublicBuilding", "lat", "lng", "metadata", "modelUrl", "panoramaKey", "photoKeys", "placeTitle", "referenceImages", "role", "state", "status", "street", "updatedAt", "userId") SELECT "blueprintSource", "city", "country", "createdAt", "errorMessage", "floorCount", "id", "isPublicBuilding", "lat", "lng", "metadata", "modelUrl", "panoramaKey", "photoKeys", "placeTitle", "referenceImages", "role", "state", "status", "street", "updatedAt", "userId" FROM "Scan";
DROP TABLE "Scan";
ALTER TABLE "new_Scan" RENAME TO "Scan";
CREATE INDEX "Scan_userId_idx" ON "Scan"("userId");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("createdAt", "expiresAt", "id", "token", "userId") SELECT "createdAt", "expiresAt", "id", "token", "userId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("id", "isPro", "plan", "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "userId") SELECT "id", "isPro", "plan", "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
