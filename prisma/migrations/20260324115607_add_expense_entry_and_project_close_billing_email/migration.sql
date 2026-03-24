-- Add ExpenseEntry + ProjectCloseBillingEmail (+ enums)

-- CreateEnum: EmailSendStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailSendStatus') THEN
    CREATE TYPE "EmailSendStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
  END IF;
END$$;

-- CreateEnum: ExpenseEntryStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseEntryStatus') THEN
    CREATE TYPE "ExpenseEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'POSTED');
  END IF;
END$$;

-- CreateEnum: ExpenseEntryKind
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseEntryKind') THEN
    CREATE TYPE "ExpenseEntryKind" AS ENUM ('MANUAL', 'EMPLOYEE_SUBMISSION', 'RETAINER_RECURRING');
  END IF;
END$$;

-- CreateTable: ProjectCloseBillingEmail
CREATE TABLE IF NOT EXISTS "ProjectCloseBillingEmail" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectClosedAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "ccEmail" TEXT,
    "subject" TEXT,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCloseBillingEmail_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques: ProjectCloseBillingEmail
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ProjectCloseBillingEmail_dedupeKey_key') THEN
    CREATE UNIQUE INDEX "ProjectCloseBillingEmail_dedupeKey_key"
      ON "ProjectCloseBillingEmail"("dedupeKey");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ProjectCloseBillingEmail_projectId_projectClosedAt_key') THEN
    CREATE UNIQUE INDEX "ProjectCloseBillingEmail_projectId_projectClosedAt_key"
      ON "ProjectCloseBillingEmail"("projectId", "projectClosedAt");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ProjectCloseBillingEmail_projectId_idx') THEN
    CREATE INDEX "ProjectCloseBillingEmail_projectId_idx"
      ON "ProjectCloseBillingEmail"("projectId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ProjectCloseBillingEmail_sentAt_idx') THEN
    CREATE INDEX "ProjectCloseBillingEmail_sentAt_idx"
      ON "ProjectCloseBillingEmail"("sentAt");
  END IF;
END$$;

-- FK: ProjectCloseBillingEmail.projectId -> Project.id (CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectCloseBillingEmail_projectId_fkey') THEN
    ALTER TABLE "ProjectCloseBillingEmail"
      ADD CONSTRAINT "ProjectCloseBillingEmail_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;


-- CreateTable: ExpenseEntry
CREATE TABLE IF NOT EXISTS "ExpenseEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "submittedByUserId" TEXT,
    "employeeId" TEXT,
    "kind" "ExpenseEntryKind" NOT NULL,
    "status" "ExpenseEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "reimburseToEmployee" BOOLEAN NOT NULL DEFAULT false,
    "receiptUrl" TEXT,
    "receiptOriginalFilename" TEXT,
    "receiptMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- FKs: ExpenseEntry
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseEntry_clientId_fkey') THEN
    ALTER TABLE "ExpenseEntry"
      ADD CONSTRAINT "ExpenseEntry_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseEntry_projectId_fkey') THEN
    ALTER TABLE "ExpenseEntry"
      ADD CONSTRAINT "ExpenseEntry_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseEntry_submittedByUserId_fkey') THEN
    ALTER TABLE "ExpenseEntry"
      ADD CONSTRAINT "ExpenseEntry_submittedByUserId_fkey"
      FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseEntry_employeeId_fkey') THEN
    ALTER TABLE "ExpenseEntry"
      ADD CONSTRAINT "ExpenseEntry_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Indexes: ExpenseEntry
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_clientId_expenseDate_idx') THEN
    CREATE INDEX "ExpenseEntry_clientId_expenseDate_idx"
      ON "ExpenseEntry"("clientId", "expenseDate");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_projectId_idx') THEN
    CREATE INDEX "ExpenseEntry_projectId_idx"
      ON "ExpenseEntry"("projectId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_submittedByUserId_expenseDate_idx') THEN
    CREATE INDEX "ExpenseEntry_submittedByUserId_expenseDate_idx"
      ON "ExpenseEntry"("submittedByUserId", "expenseDate");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_employeeId_expenseDate_idx') THEN
    CREATE INDEX "ExpenseEntry_employeeId_expenseDate_idx"
      ON "ExpenseEntry"("employeeId", "expenseDate");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_status_idx') THEN
    CREATE INDEX "ExpenseEntry_status_idx"
      ON "ExpenseEntry"("status");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_kind_idx') THEN
    CREATE INDEX "ExpenseEntry_kind_idx"
      ON "ExpenseEntry"("kind");
  END IF;
END$$;
