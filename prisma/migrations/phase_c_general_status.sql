-- Phase C migration: Add general_status enum to all 5 models
DO $$ BEGIN
  CREATE TYPE "GeneralStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_HOLD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status columns with default ACTIVE
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "general_status" "GeneralStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "general_status" "GeneralStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "role_assignments" ADD COLUMN IF NOT EXISTS "general_status" "GeneralStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "general_status" "GeneralStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "general_status" "GeneralStatus" NOT NULL DEFAULT 'ACTIVE';

-- Sync from is_active (true -> ACTIVE, false -> INACTIVE)
UPDATE "users" SET "general_status" = 'INACTIVE' WHERE "is_active" = false;
UPDATE "positions" SET "general_status" = 'INACTIVE' WHERE "is_active" = false;
UPDATE "role_assignments" SET "general_status" = 'INACTIVE' WHERE "is_active" = false;
UPDATE "va_profiles" SET "general_status" = 'INACTIVE' WHERE "is_active" = false;
UPDATE "clients" SET "general_status" = 'INACTIVE' WHERE "is_active" = false;

-- Add engagement_status to va_profiles (optional)
ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "engagement_status" "EmploymentStatus";
