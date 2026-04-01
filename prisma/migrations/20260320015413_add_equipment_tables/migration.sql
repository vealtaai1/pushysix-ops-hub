-- Add equipment inventory tables

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EquipmentItemStatus') THEN
    CREATE TYPE "EquipmentItemStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'MAINTENANCE', 'RETIRED');
  END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EquipmentItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "status" "EquipmentItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'EquipmentItem_barcode_key') THEN
    CREATE UNIQUE INDEX "EquipmentItem_barcode_key" ON "EquipmentItem"("barcode");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'EquipmentItem_status_idx') THEN
    CREATE INDEX "EquipmentItem_status_idx" ON "EquipmentItem"("status");
  END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EquipmentLoan" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),
    "checkoutNotes" TEXT,
    "checkinNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentLoan_pkey" PRIMARY KEY ("id")
);

-- FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentLoan_itemId_fkey') THEN
    ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentLoan_userId_fkey') THEN
    ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- Indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'EquipmentLoan_userId_checkedOutAt_idx') THEN
    CREATE INDEX "EquipmentLoan_userId_checkedOutAt_idx" ON "EquipmentLoan"("userId", "checkedOutAt");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'EquipmentLoan_itemId_checkedOutAt_idx') THEN
    CREATE INDEX "EquipmentLoan_itemId_checkedOutAt_idx" ON "EquipmentLoan"("itemId", "checkedOutAt");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'EquipmentLoan_checkedInAt_idx') THEN
    CREATE INDEX "EquipmentLoan_checkedInAt_idx" ON "EquipmentLoan"("checkedInAt");
  END IF;
END$$;
