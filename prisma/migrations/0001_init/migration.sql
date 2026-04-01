-- prisma:transaction false

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "BillingCycleStartDay" AS ENUM ('FIRST', 'FIFTEENTH');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingCycleStartDay" "BillingCycleStartDay" NOT NULL DEFAULT 'FIRST',
    "monthlyRetainerHours" INTEGER NOT NULL DEFAULT 0,
    "maxShootsPerCycle" INTEGER,
    "maxCaptureHoursPerCycle" INTEGER,
    "clickupSpaceId" TEXT,
    "qboCustomerId" TEXT,
    "clientBillingEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainerCycle" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetainerCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BucketLimit" (
    "id" TEXT NOT NULL,
    "retainerCycleId" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "minutesLimit" INTEGER NOT NULL,

    CONSTRAINT "BucketLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worklog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvalReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT,
    "replacedWorklogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worklog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorklogEntry" (
    "id" TEXT NOT NULL,
    "worklogId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "notes" TEXT,
    "clickupTaskUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorklogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MileageEntry" (
    "id" TEXT NOT NULL,
    "worklogId" TEXT NOT NULL,
    "kilometers" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MileageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayOff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayDate" TIMESTAMP(3) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestReason" TEXT,
    "approvalReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT,
    "replacedDayOffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Worklog_status_idx" ON "Worklog"("status");

-- CreateIndex
CREATE INDEX "Worklog_submittedAt_idx" ON "Worklog"("submittedAt");

-- CreateIndex
CREATE INDEX "Worklog_approvedAt_idx" ON "Worklog"("approvedAt");

-- CreateIndex
CREATE INDEX "Worklog_approvedByUserId_idx" ON "Worklog"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Worklog_userId_workDate_key" ON "Worklog"("userId", "workDate");

-- CreateIndex
CREATE INDEX "WorklogEntry_clientId_idx" ON "WorklogEntry"("clientId");

-- CreateIndex
CREATE INDEX "WorklogEntry_bucketKey_idx" ON "WorklogEntry"("bucketKey");

-- CreateIndex
CREATE INDEX "MileageEntry_clientId_idx" ON "MileageEntry"("clientId");

-- CreateIndex
CREATE INDEX "DayOff_dayDate_idx" ON "DayOff"("dayDate");

-- CreateIndex
CREATE INDEX "DayOff_status_idx" ON "DayOff"("status");

-- CreateIndex
CREATE INDEX "DayOff_submittedAt_idx" ON "DayOff"("submittedAt");

-- CreateIndex
CREATE INDEX "DayOff_approvedAt_idx" ON "DayOff"("approvedAt");

-- CreateIndex
CREATE INDEX "DayOff_approvedByUserId_idx" ON "DayOff"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DayOff_userId_dayDate_key" ON "DayOff"("userId", "dayDate");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RetainerCycle" ADD CONSTRAINT "RetainerCycle_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketLimit" ADD CONSTRAINT "BucketLimit_retainerCycleId_fkey" FOREIGN KEY ("retainerCycleId") REFERENCES "RetainerCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_replacedWorklogId_fkey" FOREIGN KEY ("replacedWorklogId") REFERENCES "Worklog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorklogEntry" ADD CONSTRAINT "WorklogEntry_worklogId_fkey" FOREIGN KEY ("worklogId") REFERENCES "Worklog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorklogEntry" ADD CONSTRAINT "WorklogEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageEntry" ADD CONSTRAINT "MileageEntry_worklogId_fkey" FOREIGN KEY ("worklogId") REFERENCES "Worklog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageEntry" ADD CONSTRAINT "MileageEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayOff" ADD CONSTRAINT "DayOff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayOff" ADD CONSTRAINT "DayOff_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayOff" ADD CONSTRAINT "DayOff_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayOff" ADD CONSTRAINT "DayOff_replacedDayOffId_fkey" FOREIGN KEY ("replacedDayOffId") REFERENCES "DayOff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

