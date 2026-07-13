-- Phase J migration: link VAProfile.vaaPosition to the Skill table so the
-- Position column can display Skill.short_name instead of raw free text.
-- vaaPosition stays as a free-text fallback for values that don't match a Skill.

ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "position_skill_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "va_profiles" ADD CONSTRAINT "va_profiles_position_skill_id_fkey"
    FOREIGN KEY ("position_skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "va_profiles_position_skill_id_idx" ON "va_profiles"("position_skill_id");

-- Backfill: existing vaaPosition values already equal Skill.short_name exactly
-- for the vast majority of rows (confirmed via data check), so match on that.
UPDATE "va_profiles" vp
SET "position_skill_id" = s.id
FROM "skills" s
WHERE vp."position_skill_id" IS NULL
  AND vp."vaa_position" IS NOT NULL
  AND lower(trim(vp."vaa_position")) = lower(trim(s."short_name"));
