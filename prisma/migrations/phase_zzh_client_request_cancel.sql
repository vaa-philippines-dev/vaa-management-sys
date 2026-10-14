-- Phase ZZH: cancelled date + reason on client requests (2026-10-14).
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
