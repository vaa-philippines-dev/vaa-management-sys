-- Phase ZZJ (2026-10-15): VA Concerns (the DMF sheet's "VA Concerns" tab),
-- and real submissions from the login page's "Request account" / "Trouble
-- logging in?" forms, which now notify admins.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VA_CONCERN';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VAConcernStatus') THEN
    CREATE TYPE "VAConcernStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VAConcernEscalation') THEN
    CREATE TYPE "VAConcernEscalation" AS ENUM ('MANAGER', 'HR', 'CLIENT_EXPERIENCE', 'BUSINESS_PROCESS', 'ACCOUNTING');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "va_concerns" (
  "id"                       TEXT PRIMARY KEY,
  "number"                   SERIAL NOT NULL,
  "department_id"            TEXT NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
  "va_profile_id"            TEXT NOT NULL REFERENCES "va_profiles"("id") ON DELETE CASCADE,
  "client_id"                TEXT REFERENCES "clients"("id") ON DELETE SET NULL,
  "client_name"              TEXT,
  "concern_date"             TIMESTAMP(3) NOT NULL,
  "category"                 TEXT NOT NULL,
  "concern"                  TEXT,
  "description"              TEXT,
  "suggested_mitigation"     TEXT,
  "status"                   "VAConcernStatus" NOT NULL DEFAULT 'PENDING',
  "escalated_to"             "VAConcernEscalation",
  "escalation_status"        "VAConcernStatus",
  "team_leader_action"       TEXT,
  "manager_action"           TEXT,
  "hr_action"                TEXT,
  "client_experience_action" TEXT,
  "business_process_action"  TEXT,
  "accounting_action"        TEXT,
  "reference_url"            TEXT,
  "recording_url"            TEXT,
  "escalation_reference"     TEXT,
  "sheet_concern_id"         TEXT,
  "import_key"               TEXT,
  "reported_by_id"           TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at"              TIMESTAMP(3),
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "va_concerns_number_key" ON "va_concerns"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "va_concerns_import_key_key" ON "va_concerns"("import_key");
CREATE INDEX IF NOT EXISTS "va_concerns_department_id_status_idx" ON "va_concerns"("department_id", "status");
CREATE INDEX IF NOT EXISTS "va_concerns_va_profile_id_idx" ON "va_concerns"("va_profile_id");
