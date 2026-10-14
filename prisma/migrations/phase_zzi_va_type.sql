-- Phase ZZI: TYPE OF VA on the VA profile (2026-10-14). Every existing VA
-- starts as REGULAR via the column default; HR marks external hires by hand.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VAType') THEN
    CREATE TYPE "VAType" AS ENUM ('REGULAR', 'EXPERIENCED_EXTERNAL', 'SENIOR_EXTERNAL');
  END IF;
END $$;

ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "va_type" "VAType" NOT NULL DEFAULT 'REGULAR';
