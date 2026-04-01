-- Allow project shortCode reuse across different clients.
-- Previously: Project.shortCode was globally unique.
-- Now: unique per clientId + shortCode.

DROP INDEX IF EXISTS "Project_shortCode_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Project_clientId_shortCode_key" ON "Project"("clientId", "shortCode");
