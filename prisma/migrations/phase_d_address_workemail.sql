-- Phase D migration: Add workEmail and address PSGC fields to UserProfile
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "work_email" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "region_code" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "province_code" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "city_code" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "barangay_code" TEXT;

-- Backfill: copy login email to workEmail for existing records
UPDATE "user_profiles" up
SET "work_email" = u."email"
FROM "users" u
WHERE up."user_id" = u."id"
  AND up."work_email" IS NULL
  AND u."email" IS NOT NULL;
