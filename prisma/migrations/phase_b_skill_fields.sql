-- Phase B migration: Add fields to skills
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "short_name" TEXT;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "acronym" TEXT;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "job_description" TEXT;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "attachment_url" TEXT;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now();
