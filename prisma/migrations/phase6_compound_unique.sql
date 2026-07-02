-- Phase 6 migration: drop global unique, add compound unique
-- Handle case where existing data may have duplicates in the same parent

DO $$ BEGIN
  ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_name_key";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_acronym_key";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Drop partial unique index from phase 1 if it exists
DROP INDEX IF EXISTS "departments_acronym_key";

-- Add compound unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_parent_id_key"
  ON "departments"("name", COALESCE("parent_id", ''));

CREATE UNIQUE INDEX IF NOT EXISTS "departments_acronym_parent_id_key"
  ON "departments"(COALESCE("acronym", ''), COALESCE("parent_id", ''));
