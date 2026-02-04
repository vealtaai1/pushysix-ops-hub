-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billingCycleStartDay" TEXT NOT NULL DEFAULT 'FIRST',
    "clickupSpaceId" TEXT,
    "qboCustomerId" TEXT,
    "clientBillingEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RetainerCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetainerCycle_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BucketLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retainerCycleId" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "minutesLimit" INTEGER NOT NULL,
    CONSTRAINT "BucketLimit_retainerCycleId_fkey" FOREIGN KEY ("retainerCycleId") REFERENCES "RetainerCycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Worklog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Worklog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorklogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worklogId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "notes" TEXT,
    "clickupTaskUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorklogEntry_worklogId_fkey" FOREIGN KEY ("worklogId") REFERENCES "Worklog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorklogEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "RetainerCycle_clientId_startDate_idx" ON "RetainerCycle"("clientId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "BucketLimit_retainerCycleId_bucketKey_key" ON "BucketLimit"("retainerCycleId", "bucketKey");

-- CreateIndex
CREATE INDEX "Worklog_workDate_idx" ON "Worklog"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "Worklog_userId_workDate_key" ON "Worklog"("userId", "workDate");

-- CreateIndex
CREATE INDEX "WorklogEntry_clientId_idx" ON "WorklogEntry"("clientId");

-- CreateIndex
CREATE INDEX "WorklogEntry_bucketKey_idx" ON "WorklogEntry"("bucketKey");

-- CreateIndex
CREATE INDEX "MileageEntry_clientId_idx" ON "MileageEntry"("clientId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
