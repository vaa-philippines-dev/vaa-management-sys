-- Phase G migration: unified VAHistory log, department-transfer support, staff-inclusive headcount data

-- 1. New enums
DO $$ BEGIN
  CREATE TYPE "HistoryEventType" AS ENUM (
    'STATUS_CHANGE', 'ENGAGEMENT_CHANGE', 'UPSKILL', 'RATE_CHANGE', 'PROMOTION', 'DEPARTMENT_TRANSFER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransferType" AS ENUM ('ACTIVE', 'END_OF_CONTRACT', 'HYBRID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Unified va_history table
CREATE TABLE IF NOT EXISTS "va_history" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_type" "HistoryEventType" NOT NULL,
  "old_value" TEXT,
  "new_value" TEXT,
  "department_id" TEXT,
  "effective_date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "changed_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "va_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "va_history_user_id_effective_date_idx" ON "va_history"("user_id", "effective_date");
CREATE INDEX IF NOT EXISTS "va_history_event_type_effective_date_idx" ON "va_history"("event_type", "effective_date");

DO $$ BEGIN
  ALTER TABLE "va_history" ADD CONSTRAINT "va_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "va_history" ADD CONSTRAINT "va_history_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "va_history" ADD CONSTRAINT "va_history_changed_by_id_fkey"
    FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Backfill from va_status_history (if that table still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'va_status_history') THEN
    INSERT INTO "va_history" ("id", "user_id", "event_type", "old_value", "new_value", "effective_date", "reason", "changed_by_id", "created_at")
    SELECT
      h."id",
      p."user_id",
      CASE WHEN h."status_type" = 'GENERAL' THEN 'STATUS_CHANGE' ELSE 'ENGAGEMENT_CHANGE' END::"HistoryEventType",
      h."old_value",
      h."new_value",
      h."effective_date",
      h."reason",
      h."changed_by_id",
      h."created_at"
    FROM "va_status_history" h
    JOIN "va_profiles" p ON p."id" = h."va_profile_id"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- 4. Drop old status-only table + enum now that it's backfilled
DROP TABLE IF EXISTS "va_status_history";
DROP TYPE IF EXISTS "VAStatusType";

-- 5. DepartmentMembership: per-membership rate + transfer metadata, drop single-membership-per-department constraint
ALTER TABLE "department_memberships" ADD COLUMN IF NOT EXISTS "hourly_rate" DECIMAL(65,30);
ALTER TABLE "department_memberships" ADD COLUMN IF NOT EXISTS "base_rate" DECIMAL(65,30);
ALTER TABLE "department_memberships" ADD COLUMN IF NOT EXISTS "transfer_type" "TransferType";
ALTER TABLE "department_memberships" ADD COLUMN IF NOT EXISTS "transferred_from_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_transferred_from_id_fkey"
    FOREIGN KEY ("transferred_from_id") REFERENCES "department_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "department_memberships" DROP CONSTRAINT IF EXISTS "department_memberships_user_id_department_id_key";
CREATE INDEX IF NOT EXISTS "department_memberships_user_id_department_id_idx" ON "department_memberships"("user_id", "department_id");

-- 6. EmploymentRecord: attach a department for per-department headcount reporting
ALTER TABLE "employment_records" ADD COLUMN IF NOT EXISTS "department_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "employment_records_department_id_start_date_idx" ON "employment_records"("department_id", "start_date");
