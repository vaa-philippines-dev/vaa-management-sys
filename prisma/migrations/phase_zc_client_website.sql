-- Phase ZC migration: adds a website column to clients, surfaced by CSV
-- imports that carry a company website (e.g. the Wholesale masterlist).

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "website" TEXT;
