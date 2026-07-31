-- Phase ZF migration: employee ID standard ("VA-<YY>-<seq>") + house-number
-- address field, per the 2026-07-28 workforce system testing meeting.
-- The counter table backs a race-free per-year sequence (UPDATE...RETURNING
-- in lib/employee-id.ts) instead of a count()-based scheme.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_employee_id_key" ON "users"("employee_id");

ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "house_number" TEXT;

CREATE TABLE IF NOT EXISTS "employee_id_counters" (
  "year" INTEGER NOT NULL,
  "last_seq" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "employee_id_counters_pkey" PRIMARY KEY ("year")
);
