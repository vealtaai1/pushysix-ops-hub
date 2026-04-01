-- Expense categories (enables finance breakdowns)
--
-- This migration is written to be safe on databases that do not yet have the
-- ExpenseCategory enum or the ExpenseEntry.category column.

DO $$
BEGIN
  -- 1) Create enum type if it doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typname = 'ExpenseCategory'
  ) THEN
    CREATE TYPE "ExpenseCategory" AS ENUM (
      'MILEAGE',
      'HOTEL_ACCOMMODATION',
      'MEAL',
      'PROP',
      'CAMERA_GEAR_EQUIPMENT',
      'PARKING',
      'CAR_RENTAL',
      'FUEL',
      'OTHER'
    );
  END IF;

  -- 2) Ensure new values exist (safe if type already existed)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ExpenseCategory' AND e.enumlabel = 'PARKING'
  ) THEN
    ALTER TYPE "ExpenseCategory" ADD VALUE 'PARKING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ExpenseCategory' AND e.enumlabel = 'CAR_RENTAL'
  ) THEN
    ALTER TYPE "ExpenseCategory" ADD VALUE 'CAR_RENTAL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ExpenseCategory' AND e.enumlabel = 'FUEL'
  ) THEN
    ALTER TYPE "ExpenseCategory" ADD VALUE 'FUEL';
  END IF;

  -- 3) Add category column to ExpenseEntry if missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ExpenseEntry' AND column_name = 'category'
  ) THEN
    ALTER TABLE "ExpenseEntry"
      ADD COLUMN "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER';
  END IF;
END$$;
