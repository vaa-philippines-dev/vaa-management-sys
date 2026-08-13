-- Phase ZL migration: department-level standard base rate, requested in the
-- 2026-08-12 Workforce Management System meeting so upskilling transfers have
-- a documented default rate per department instead of relying on memory.

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "base_rate" DECIMAL;
