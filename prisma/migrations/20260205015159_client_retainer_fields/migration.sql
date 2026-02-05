/*
  Warnings:

  - You are about to drop the `MileageAllocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `totalKilometersTarget` on the `Worklog` table. All the data in the column will be lost.
  - You are about to drop the column `totalMinutesTarget` on the `Worklog` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "MileageAllocation_worklogId_clientId_key";

-- DropIndex
DROP INDEX "MileageAllocation_clientId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MileageAllocation";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "MileageEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worklogId" TEXT NOT NULL,
    "kilometers" REAL NOT NULL,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MileageEntry_worklogId_fkey" FOREIGN KEY ("worklogId") REFERENCES "Worklog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MileageEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billingCycleStartDay" TEXT NOT NULL DEFAULT 'FIRST',
    "monthlyRetainerHours" INTEGER NOT NULL DEFAULT 0,
    "maxShootsPerCycle" INTEGER,
    "maxCaptureHoursPerCycle" INTEGER,
    "clickupSpaceId" TEXT,
    "qboCustomerId" TEXT,
    "clientBillingEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Client" ("billingCycleStartDay", "clickupSpaceId", "clientBillingEmail", "createdAt", "id", "name", "qboCustomerId", "status", "updatedAt") SELECT "billingCycleStartDay", "clickupSpaceId", "clientBillingEmail", "createdAt", "id", "name", "qboCustomerId", "status", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_status_idx" ON "Client"("status");
CREATE TABLE "new_Worklog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
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
CREATE INDEX "MileageEntry_clientId_idx" ON "MileageEntry"("clientId");
