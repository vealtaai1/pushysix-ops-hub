-- Add total cost fields to Project for misc-project finance reporting

ALTER TABLE "Project"
ADD COLUMN "totalCostCents" INTEGER,
ADD COLUMN "totalCostCurrency" TEXT NOT NULL DEFAULT 'CAD';
