-- Backfill Project.shortCode for existing rows (pre-req for @unique/@required)
-- Safe to run multiple times.

-- 1) Ensure column exists (older DBs may not have it yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Project'
      AND column_name = 'shortCode'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "shortCode" TEXT;
  END IF;
END$$;

-- 2) Backfill any missing/blank shortCode values with a unique 12-char token.
-- Uses md5(random + clock_timestamp) to avoid requiring pgcrypto.
DO $$
DECLARE
  r RECORD;
  sc TEXT;
  tries INT;
BEGIN
  FOR r IN
    SELECT id
    FROM "Project"
    WHERE "shortCode" IS NULL OR btrim("shortCode") = ''
  LOOP
    tries := 0;

    LOOP
      tries := tries + 1;
      sc := substring(md5(random()::text || clock_timestamp()::text) from 1 for 12);

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "Project" p
        WHERE p."shortCode" = sc
      );

      IF tries >= 50 THEN
        RAISE EXCEPTION 'Could not generate unique shortCode for Project % after % tries', r.id, tries;
      END IF;
    END LOOP;

    UPDATE "Project" SET "shortCode" = sc WHERE id = r.id;
  END LOOP;
END$$;

-- 3) Enforce uniqueness (Prisma expects @unique)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Project_shortCode_key') THEN
    CREATE UNIQUE INDEX "Project_shortCode_key" ON "Project"("shortCode");
  END IF;
END$$;

-- 4) Make required (Prisma expects non-null)
DO $$
BEGIN
  -- Only flip to NOT NULL if there are no missing/blank values.
  IF NOT EXISTS (
    SELECT 1
    FROM "Project"
    WHERE "shortCode" IS NULL OR btrim("shortCode") = ''
  ) THEN
    ALTER TABLE "Project" ALTER COLUMN "shortCode" SET NOT NULL;
  END IF;
END$$;
