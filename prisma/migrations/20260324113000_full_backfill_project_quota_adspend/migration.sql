-- prisma:transaction false

-- FULL backfill migration for historical DBs missing:
-- - Project table + ProjectStatus enum
-- - ClientQuotaItem table + QuotaUsageMode enum
-- - RetainerAdSpendItem table
-- - UserRole enum value: ACCOUNT_MANAGER
--
-- This migration is written to be idempotent/safe to run on DBs that already have
-- some or all of these objects.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Ensure ProjectStatus exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectStatus') THEN
    CREATE TYPE "ProjectStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
END$$;

-- Ensure QuotaUsageMode exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuotaUsageMode') THEN
    CREATE TYPE "QuotaUsageMode" AS ENUM ('PER_DAY', 'PER_HOUR');
  END IF;
END$$;

-- Ensure UserRole has ACCOUNT_MANAGER
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'ACCOUNT_MANAGER'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'ACCOUNT_MANAGER';
    END IF;
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Project
CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,

  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "shortCode" TEXT NOT NULL,

  "status" "ProjectStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- Uniques / indexes for Project
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Project_shortCode_key') THEN
    CREATE UNIQUE INDEX "Project_shortCode_key" ON "Project"("shortCode");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Project_clientId_code_key') THEN
    CREATE UNIQUE INDEX "Project_clientId_code_key" ON "Project"("clientId", "code");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Project_clientId_idx') THEN
    CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Project_status_idx') THEN
    CREATE INDEX "Project_status_idx" ON "Project"("status");
  END IF;
END$$;

-- FK: Project.clientId -> Client.id (CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_clientId_fkey') THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;


-- ClientQuotaItem
CREATE TABLE IF NOT EXISTS "ClientQuotaItem" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,

  "key" TEXT,
  "name" TEXT NOT NULL,

  "usageMode" "QuotaUsageMode" NOT NULL DEFAULT 'PER_HOUR',

  "limitPerCycleDays" INTEGER NOT NULL DEFAULT 0,
  "limitPerCycleMinutes" INTEGER NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientQuotaItem_pkey" PRIMARY KEY ("id")
);

-- Uniques / indexes for ClientQuotaItem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ClientQuotaItem_clientId_name_key') THEN
    CREATE UNIQUE INDEX "ClientQuotaItem_clientId_name_key" ON "ClientQuotaItem"("clientId", "name");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ClientQuotaItem_clientId_idx') THEN
    CREATE INDEX "ClientQuotaItem_clientId_idx" ON "ClientQuotaItem"("clientId");
  END IF;
END$$;

-- FK: ClientQuotaItem.clientId -> Client.id (CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClientQuotaItem_clientId_fkey') THEN
    ALTER TABLE "ClientQuotaItem"
      ADD CONSTRAINT "ClientQuotaItem_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;


-- RetainerAdSpendItem
CREATE TABLE IF NOT EXISTS "RetainerAdSpendItem" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "retainerCycleId" TEXT NOT NULL,

  "platformKey" TEXT NOT NULL,
  "platformName" TEXT NOT NULL,

  "quotaCents" INTEGER NOT NULL DEFAULT 0,
  "actualCents" INTEGER NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RetainerAdSpendItem_pkey" PRIMARY KEY ("id")
);

-- Uniques / indexes for RetainerAdSpendItem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'RetainerAdSpendItem_retainerCycleId_platformKey_key') THEN
    CREATE UNIQUE INDEX "RetainerAdSpendItem_retainerCycleId_platformKey_key"
      ON "RetainerAdSpendItem"("retainerCycleId", "platformKey");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'RetainerAdSpendItem_clientId_idx') THEN
    CREATE INDEX "RetainerAdSpendItem_clientId_idx" ON "RetainerAdSpendItem"("clientId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'RetainerAdSpendItem_retainerCycleId_idx') THEN
    CREATE INDEX "RetainerAdSpendItem_retainerCycleId_idx" ON "RetainerAdSpendItem"("retainerCycleId");
  END IF;
END$$;

-- FKs: RetainerAdSpendItem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetainerAdSpendItem_clientId_fkey') THEN
    ALTER TABLE "RetainerAdSpendItem"
      ADD CONSTRAINT "RetainerAdSpendItem_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetainerAdSpendItem_retainerCycleId_fkey') THEN
    ALTER TABLE "RetainerAdSpendItem"
      ADD CONSTRAINT "RetainerAdSpendItem_retainerCycleId_fkey"
      FOREIGN KEY ("retainerCycleId") REFERENCES "RetainerCycle"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
