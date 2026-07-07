-- Phase F migration: VA status change history with user-chosen effective dates
DO $$ BEGIN
  CREATE TYPE "VAStatusType" AS ENUM ('GENERAL', 'ENGAGEMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "va_status_history" (
  "id" TEXT NOT NULL,
  "va_profile_id" TEXT NOT NULL,
  "status_type" "VAStatusType" NOT NULL,
  "old_value" TEXT,
  "new_value" TEXT NOT NULL,
  "effective_date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "changed_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "va_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "va_status_history_va_profile_id_effective_date_idx"
  ON "va_status_history"("va_profile_id", "effective_date");

DO $$ BEGIN
  ALTER TABLE "va_status_history"
    ADD CONSTRAINT "va_status_history_va_profile_id_fkey"
    FOREIGN KEY ("va_profile_id") REFERENCES "va_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "va_status_history"
    ADD CONSTRAINT "va_status_history_changed_by_id_fkey"
    FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
