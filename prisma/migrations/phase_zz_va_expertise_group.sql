-- Phase ZZ migration: adds VAProfile.expertise_group_id, a nullable FK to
-- Department used as the VA Profile page's "Expertise Group" dropdown.
-- Reuses the Department tree instead of a separate free-text list.

ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "expertise_group_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "va_profiles" ADD CONSTRAINT "va_profiles_expertise_group_id_fkey"
    FOREIGN KEY ("expertise_group_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "va_profiles_expertise_group_id_idx" ON "va_profiles"("expertise_group_id");
