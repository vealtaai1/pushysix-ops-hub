-- Add money fields (stored as cents) for Client + User

-- Client.monthlyRetainerFeeCents (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Client'
      AND column_name = 'monthlyRetainerFeeCents'
  ) THEN
    ALTER TABLE "Client" ADD COLUMN "monthlyRetainerFeeCents" INTEGER;
  END IF;
END$$;

-- Client.monthlyRetainerFeeCurrency (non-null with default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Client'
      AND column_name = 'monthlyRetainerFeeCurrency'
  ) THEN
    ALTER TABLE "Client" ADD COLUMN "monthlyRetainerFeeCurrency" TEXT NOT NULL DEFAULT 'CAD';
  END IF;
END$$;

-- User.hourlyWageCents (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name = 'hourlyWageCents'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "hourlyWageCents" INTEGER;
  END IF;
END$$;

-- User.hourlyWageCurrency (non-null with default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name = 'hourlyWageCurrency'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "hourlyWageCurrency" TEXT NOT NULL DEFAULT 'CAD';
  END IF;
END$$;
