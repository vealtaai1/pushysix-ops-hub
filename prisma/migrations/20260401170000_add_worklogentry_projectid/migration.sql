-- Add optional WorklogEntry.projectId linkage so employee worklogs can be attributed to a specific open project.

ALTER TABLE "WorklogEntry" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorklogEntry_projectId_fkey') THEN
    ALTER TABLE "WorklogEntry"
      ADD CONSTRAINT "WorklogEntry_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WorklogEntry_projectId_idx') THEN
    CREATE INDEX "WorklogEntry_projectId_idx" ON "WorklogEntry"("projectId");
  END IF;
END $$;
