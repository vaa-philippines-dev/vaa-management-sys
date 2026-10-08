-- Phase ZZC: let admins remove a VA from a department's VA Availability list
-- without ending their department membership.
ALTER TABLE "va_department_availability" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3);
