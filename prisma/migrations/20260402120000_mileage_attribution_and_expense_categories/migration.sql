-- Add Mileage attribution columns (projectId/engagementType) + expand ExpenseCategory enum

-- Ensure WorklogEngagementType exists (safety for older DBs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorklogEngagementType') THEN
    CREATE TYPE "WorklogEngagementType" AS ENUM ('RETAINER', 'MISC_PROJECT');
  END IF;
END$$;

-- Expand ExpenseCategory enum (safe add-if-missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ExpenseCategory' AND e.enumlabel = 'FLIGHT_EXPENSE'
    ) THEN
      ALTER TYPE "ExpenseCategory" ADD VALUE 'FLIGHT_EXPENSE';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ExpenseCategory' AND e.enumlabel = 'GROUND_TRANSPORTATION'
    ) THEN
      ALTER TYPE "ExpenseCategory" ADD VALUE 'GROUND_TRANSPORTATION';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ExpenseCategory' AND e.enumlabel = 'AD_SPEND'
    ) THEN
      ALTER TYPE "ExpenseCategory" ADD VALUE 'AD_SPEND';
    END IF;
  END IF;
END$$;

-- MileageEntry: add attribution columns (prod drift safety)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MileageEntry') THEN
    -- engagementType (default RETAINER)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'MileageEntry' AND column_name = 'engagementType'
    ) THEN
      ALTER TABLE "MileageEntry"
        ADD COLUMN "engagementType" "WorklogEngagementType" NOT NULL DEFAULT 'RETAINER';
    END IF;

    -- projectId (nullable)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'MileageEntry' AND column_name = 'projectId'
    ) THEN
      ALTER TABLE "MileageEntry"
        ADD COLUMN "projectId" TEXT;
    END IF;
  END IF;
END$$;

-- Indexes for MileageEntry attribution
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MileageEntry_engagementType_idx') THEN
    CREATE INDEX "MileageEntry_engagementType_idx" ON "MileageEntry"("engagementType");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MileageEntry_projectId_idx') THEN
    CREATE INDEX "MileageEntry_projectId_idx" ON "MileageEntry"("projectId");
  END IF;
END$$;

-- FK: MileageEntry.projectId -> Project.id (SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MileageEntry_projectId_fkey') THEN
    ALTER TABLE "MileageEntry"
      ADD CONSTRAINT "MileageEntry_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
