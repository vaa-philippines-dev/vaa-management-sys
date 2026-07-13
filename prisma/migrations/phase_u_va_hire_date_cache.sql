-- Phase U migration: cache each VA's most-recent EmploymentRecord dates onto
-- VAProfile so the /vas roster can sort by Hire Date / EOC-Transfer Date at
-- the database level (EmploymentRecord is a one-to-many table, not directly
-- orderable through a paginated VAProfile query).

ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "current_hire_date" TIMESTAMP(3);
ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "current_end_date" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "va_profiles_current_hire_date_idx" ON "va_profiles"("current_hire_date");

-- Backfill: each VA's most recent EmploymentRecord by start_date.
WITH latest_records AS (
  SELECT DISTINCT ON (user_id) user_id, start_date, end_date
  FROM employment_records
  ORDER BY user_id, start_date DESC
)
UPDATE "va_profiles" vp
SET "current_hire_date" = lr.start_date,
    "current_end_date" = lr.end_date
FROM latest_records lr
WHERE vp."user_id" = lr.user_id;
