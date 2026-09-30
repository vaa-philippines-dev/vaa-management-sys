-- Phase ZX migration: VA Preparation / VA Availability feedback round.
--
-- 1. VA STATUS WITH CLIENT gains CANCELLED and may now be blank. It used to
--    default to ACTIVE everywhere (schema default, form, importer), so every
--    row read "Active" whether or not anyone said so. It now stays blank
--    until VA Connect is Done. Clearing the rows that were only ever
--    defaulted is a data change, done separately by
--    scripts/backfill-prep-client-status.ts (it needs the DMF sheet to tell
--    a real "Active" from a defaulted one).
-- 2. VA BUFFERS becomes a pick-list of VAs (assignment_preparation_buffers).
--    The old va_buffers text column stays for names that match no VA.
-- 3. Availability gains the DMF's hand-set "Change Availability" options.

ALTER TYPE "PreparationClientStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "Availability" ADD VALUE IF NOT EXISTS 'ON_HOLD_BY_VA';
ALTER TYPE "Availability" ADD VALUE IF NOT EXISTS 'ON_HOLD_BY_VAA';
ALTER TYPE "Availability" ADD VALUE IF NOT EXISTS 'RECOMMENDED';

ALTER TABLE "assignment_preparations"
  ALTER COLUMN "client_status" DROP DEFAULT,
  ALTER COLUMN "client_status" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "assignment_preparation_buffers" (
  "id" TEXT NOT NULL,
  "preparation_id" TEXT NOT NULL,
  "va_profile_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_preparation_buffers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assignment_preparation_buffers_preparation_id_va_profile_id_key"
  ON "assignment_preparation_buffers"("preparation_id", "va_profile_id");
CREATE INDEX IF NOT EXISTS "assignment_preparation_buffers_va_profile_id_idx"
  ON "assignment_preparation_buffers"("va_profile_id");

ALTER TABLE "assignment_preparation_buffers"
  ADD CONSTRAINT "assignment_preparation_buffers_preparation_id_fkey"
    FOREIGN KEY ("preparation_id") REFERENCES "assignment_preparations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "assignment_preparation_buffers_va_profile_id_fkey"
    FOREIGN KEY ("va_profile_id") REFERENCES "va_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
