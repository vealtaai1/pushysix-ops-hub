-- Add engagementType to WorklogEntry so entries can be split as Retainer vs Misc Project

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorklogEngagementType') THEN
    CREATE TYPE "WorklogEngagementType" AS ENUM ('RETAINER', 'MISC_PROJECT');
  END IF;
END$$;

ALTER TABLE "WorklogEntry"
  ADD COLUMN IF NOT EXISTS "engagementType" "WorklogEngagementType" NOT NULL DEFAULT 'RETAINER';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WorklogEntry_engagementType_idx') THEN
    CREATE INDEX "WorklogEntry_engagementType_idx"
      ON "WorklogEntry"("engagementType");
  END IF;
END$$;
