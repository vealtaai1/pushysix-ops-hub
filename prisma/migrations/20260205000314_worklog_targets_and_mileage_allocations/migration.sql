/*
  Warnings:

  - You are about to drop the `MileageEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "MileageEntry_clientId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MileageEntry";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "MileageAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worklogId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kilometers" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MileageAllocation_worklogId_fkey" FOREIGN KEY ("worklogId") REFERENCES "Worklog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MileageAllocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Worklog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "totalMinutesTarget" INTEGER NOT NULL DEFAULT 0,
    "totalKilometersTarget" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Worklog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Worklog" ("createdAt", "id", "updatedAt", "userId", "workDate") SELECT "createdAt", "id", "updatedAt", "userId", "workDate" FROM "Worklog";
DROP TABLE "Worklog";
ALTER TABLE "new_Worklog" RENAME TO "Worklog";
CREATE INDEX "Worklog_workDate_idx" ON "Worklog"("workDate");
CREATE UNIQUE INDEX "Worklog_userId_workDate_key" ON "Worklog"("userId", "workDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MileageAllocation_clientId_idx" ON "MileageAllocation"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MileageAllocation_worklogId_clientId_key" ON "MileageAllocation"("worklogId", "clientId");
