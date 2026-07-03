-- Phase E migration: Repurpose SkillCategory from platform tags to Hiring Type
-- Old values: AMAZON, WALMART, TIKTOK_SHOP, SHOPIFY, GENERAL
-- New values: STANDARD, UPSKILL, SPECIAL
-- Data mapping: all existing rows -> STANDARD

DO $$ BEGIN
  CREATE TYPE "SkillCategory_new" AS ENUM ('STANDARD', 'UPSKILL', 'SPECIAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "skills" ALTER COLUMN "category" DROP DEFAULT;

ALTER TABLE "skills"
  ALTER COLUMN "category" TYPE "SkillCategory_new"
  USING (
    CASE "category"::text
      WHEN 'AMAZON' THEN 'STANDARD'
      WHEN 'WALMART' THEN 'STANDARD'
      WHEN 'TIKTOK_SHOP' THEN 'STANDARD'
      WHEN 'SHOPIFY' THEN 'STANDARD'
      WHEN 'GENERAL' THEN 'STANDARD'
      ELSE 'STANDARD'
    END
  )::"SkillCategory_new";

ALTER TABLE "skills" ALTER COLUMN "category" SET DEFAULT 'STANDARD';

DROP TYPE IF EXISTS "SkillCategory";
ALTER TYPE "SkillCategory_new" RENAME TO "SkillCategory";
