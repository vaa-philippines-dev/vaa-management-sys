-- Phase ZI migration: bot-account flag, so system/automation accounts (e.g.
-- Vee's Inbox notifications) can be visually marked "Bot" wherever their name
-- appears, instead of looking like a real staff member.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_bot" BOOLEAN NOT NULL DEFAULT false;
