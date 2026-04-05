-- Add engagementType to ExpenseEntry so expenses can be attributed as RETAINER vs MISC_PROJECT

-- Ensure WorklogEngagementType exists (safety for older DBs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorklogEngagementType') THEN
    CREATE TYPE "WorklogEngagementType" AS ENUM ('RETAINER', 'MISC_PROJECT');
  END IF;
END$$;

-- ExpenseEntry: add engagementType column (prod drift safety)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ExpenseEntry') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ExpenseEntry' AND column_name = 'engagementType'
    ) THEN
      ALTER TABLE "ExpenseEntry"
        ADD COLUMN "engagementType" "WorklogEngagementType" NOT NULL DEFAULT 'RETAINER';
    END IF;
  END IF;
END$$;

-- Index for ExpenseEntry engagementType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_engagementType_idx') THEN
    CREATE INDEX "ExpenseEntry_engagementType_idx" ON "ExpenseEntry"("engagementType");
  END IF;
END$$;
