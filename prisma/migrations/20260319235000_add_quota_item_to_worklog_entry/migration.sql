-- Add optional quota item linkage for worklog lines

ALTER TABLE "WorklogEntry" ADD COLUMN "quotaItemId" TEXT;

-- FK to ClientQuotaItem (optional; set null on delete)
ALTER TABLE "WorklogEntry"
  ADD CONSTRAINT "WorklogEntry_quotaItemId_fkey"
  FOREIGN KEY ("quotaItemId")
  REFERENCES "ClientQuotaItem"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "WorklogEntry_quotaItemId_idx" ON "WorklogEntry"("quotaItemId");
