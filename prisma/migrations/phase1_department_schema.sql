-- Phase 1 migration: Department schema upgrade
-- 1. Add new enum types
-- 2. Add new columns (merged_into_id, split_from_id, status)
-- 3. Convert level String to DepartmentLevel enum
-- 4. Convert is_active boolean to status enum
-- 5. Add Executive level record
-- 6. Drop old is_active column

DO $$ BEGIN
  CREATE TYPE "DepartmentStatus" AS ENUM ('ACTIVE', 'MERGED', 'SPLIT', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DepartmentLevel" AS ENUM ('EXECUTIVE', 'MANAGEMENT', 'SERVICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "status" "DepartmentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "merged_into_id" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "split_from_id" TEXT;

-- Sync status from is_active (one-time data migration)
UPDATE "departments" SET "status" = 'INACTIVE' WHERE "is_active" = false AND "status" = 'ACTIVE';
UPDATE "departments" SET "status" = 'ACTIVE' WHERE "is_active" = true AND "status" = 'ACTIVE';

-- Add new level column as enum
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "level_new" "DepartmentLevel";

-- Convert existing String level values to enum
UPDATE "departments" SET "level_new" = 'EXECUTIVE' WHERE "level" = 'EXECUTIVE';
UPDATE "departments" SET "level_new" = 'MANAGEMENT' WHERE "level" = 'MANAGEMENT';
UPDATE "departments" SET "level_new" = 'SERVICE' WHERE "level" = 'SERVICE';
UPDATE "departments" SET "level_new" = 'MANAGEMENT' WHERE "level" = 'Management' AND "level_new" IS NULL;
UPDATE "departments" SET "level_new" = 'SERVICE' WHERE "level" = 'Service' AND "level_new" IS NULL;

-- Drop old columns
ALTER TABLE "departments" DROP COLUMN IF EXISTS "is_active";
ALTER TABLE "departments" DROP COLUMN IF EXISTS "level";

-- Rename new column to level
ALTER TABLE "departments" RENAME COLUMN "level_new" TO "level";

-- Add foreign key constraints for merge/split
DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_merged_into_id_fkey"
    FOREIGN KEY ("merged_into_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_split_from_id_fkey"
    FOREIGN KEY ("split_from_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS "departments_status_idx" ON "departments"("status");
CREATE INDEX IF NOT EXISTS "departments_level_idx" ON "departments"("level");
CREATE INDEX IF NOT EXISTS "departments_merged_into_id_idx" ON "departments"("merged_into_id");
CREATE INDEX IF NOT EXISTS "departments_split_from_id_idx" ON "departments"("split_from_id");
