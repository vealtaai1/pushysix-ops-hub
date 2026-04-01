-- Add client contact fields
ALTER TABLE "Client"
ADD COLUMN IF NOT EXISTS "mainContactName" TEXT,
ADD COLUMN IF NOT EXISTS "mainContactEmail" TEXT,
ADD COLUMN IF NOT EXISTS "billingContactName" TEXT,
ADD COLUMN IF NOT EXISTS "billingContactEmail" TEXT;

-- Add project short description
ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
