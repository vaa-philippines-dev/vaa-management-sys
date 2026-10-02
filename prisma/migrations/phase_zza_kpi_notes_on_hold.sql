-- Phase ZZA migration: Feedback Log round (2026-10-01).
--
-- 1. KPI call notes (FB-0008): each Performance Monitoring check-in gets a
--    free-text notes box for what was discussed on the call.
-- 2. "On Leave" becomes "On hold by VA" (FB-0010) — the DMF uses it for a VA
--    who asked not to be recommended to a client for a while. ON_LEAVE stays
--    in the enum (Postgres can't drop a value without rebuilding the type),
--    but is no longer offered; existing rows move to ON_HOLD_BY_VA.

ALTER TABLE "assignment_kpi_checks" ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "va_profiles" SET "availability_status" = 'ON_HOLD_BY_VA' WHERE "availability_status" = 'ON_LEAVE';
UPDATE "va_department_availability" SET "availability_status" = 'ON_HOLD_BY_VA' WHERE "availability_status" = 'ON_LEAVE';
UPDATE "va_department_availability" SET "tmf_availability_status" = 'ON_HOLD_BY_VA' WHERE "tmf_availability_status" = 'ON_LEAVE';
