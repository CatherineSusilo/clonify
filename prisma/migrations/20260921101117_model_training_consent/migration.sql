-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT,
    "unitPreference" TEXT NOT NULL DEFAULT 'IMPERIAL',
    "productSelections" TEXT NOT NULL DEFAULT '[]',
    "modelTrainingConsent" BOOLEAN NOT NULL DEFAULT false,
    "modelTrainingConsentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash", "productSelections", "role", "unitPreference", "updatedAt") SELECT "createdAt", "email", "id", "passwordHash", "productSelections", "role", "unitPreference", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
