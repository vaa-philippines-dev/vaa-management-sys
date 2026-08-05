-- Phase ZJ migration: fields requested in the 2026-08-04 Workforce System
-- Feedback Review meeting — religion (onboarding classification) and a
-- separate Payoneer ID (payoneer_account already covers the Payoneer email).

ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "religion" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "payoneer_id" TEXT;
