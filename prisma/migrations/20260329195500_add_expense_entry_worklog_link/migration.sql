-- Add optional linkage: ExpenseEntry.worklogId -> Worklog.id

-- AddColumn
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ExpenseEntry'
      AND column_name = 'worklogId'
  ) THEN
    ALTER TABLE "ExpenseEntry" ADD COLUMN "worklogId" TEXT;
  END IF;
END$$;

-- Foreign key: ExpenseEntry.worklogId -> Worklog.id (SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseEntry_worklogId_fkey') THEN
    ALTER TABLE "ExpenseEntry"
      ADD CONSTRAINT "ExpenseEntry_worklogId_fkey"
      FOREIGN KEY ("worklogId") REFERENCES "Worklog"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Index: ExpenseEntry.worklogId
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ExpenseEntry_worklogId_idx') THEN
    CREATE INDEX "ExpenseEntry_worklogId_idx"
      ON "ExpenseEntry"("worklogId");
  END IF;
END$$;
