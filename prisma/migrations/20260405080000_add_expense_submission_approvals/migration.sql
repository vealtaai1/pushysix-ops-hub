-- Add EXPENSE_SUBMISSION approval type + link ApprovalRequest -> ExpenseEntry

-- ApprovalType: add EXPENSE_SUBMISSION enum value (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalType') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ApprovalType' AND e.enumlabel = 'EXPENSE_SUBMISSION'
    ) THEN
      ALTER TYPE "ApprovalType" ADD VALUE 'EXPENSE_SUBMISSION';
    END IF;
  END IF;
END$$;

-- ApprovalRequest: add expenseEntryId column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ApprovalRequest') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ApprovalRequest' AND column_name = 'expenseEntryId'
    ) THEN
      ALTER TABLE "ApprovalRequest" ADD COLUMN "expenseEntryId" TEXT;
    END IF;
  END IF;
END$$;

-- FK: ApprovalRequest(expenseEntryId) -> ExpenseEntry(id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ApprovalRequest')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ExpenseEntry') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = 'ApprovalRequest'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'ApprovalRequest_expenseEntryId_fkey'
    ) THEN
      ALTER TABLE "ApprovalRequest"
        ADD CONSTRAINT "ApprovalRequest_expenseEntryId_fkey"
        FOREIGN KEY ("expenseEntryId") REFERENCES "ExpenseEntry"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

-- Index: ApprovalRequest(expenseEntryId)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ApprovalRequest_expenseEntryId_idx') THEN
    CREATE INDEX "ApprovalRequest_expenseEntryId_idx" ON "ApprovalRequest"("expenseEntryId");
  END IF;
END$$;
