-- Add indexes to speed joins from Worklog -> WorklogEntry (+ MileageEntry)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WorklogEntry_worklogId_idx') THEN
    CREATE INDEX "WorklogEntry_worklogId_idx"
      ON "WorklogEntry"("worklogId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MileageEntry_worklogId_idx') THEN
    CREATE INDEX "MileageEntry_worklogId_idx"
      ON "MileageEntry"("worklogId");
  END IF;
END$$;
