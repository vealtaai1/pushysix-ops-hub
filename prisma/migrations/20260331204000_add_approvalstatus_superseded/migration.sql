-- Add SUPERSEDED status to ApprovalStatus enum
-- This keeps at most one pending approval request per worklog/day-off by allowing older pending requests to be marked as superseded.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ApprovalStatus'
      AND e.enumlabel = 'SUPERSEDED'
  ) THEN
    ALTER TYPE "ApprovalStatus" ADD VALUE 'SUPERSEDED';
  END IF;
END$$;
