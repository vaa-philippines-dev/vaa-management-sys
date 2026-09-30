-- Phase ZW migration: Staff Masterlist. One row per engagement from the
-- "VAA | STAFF MASTERLIST" sheet, optionally linked to the person's login
-- account. Populated by scripts/import-staff-masterlist.ts.

CREATE TABLE IF NOT EXISTS "staff_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "staff_id" TEXT,
  "hire_date" TIMESTAMP(3),
  "start_date" TIMESTAMP(3),
  "department" TEXT,
  "subdepartment" TEXT,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT,
  "position" TEXT,
  "level" TEXT,
  "work_email" TEXT,
  "personal_email" TEXT,
  "whatsapp" TEXT,
  "gcash" TEXT,
  "emergency_contact" TEXT,
  "address" TEXT,
  "birth_date" TIMESTAMP(3),
  "remarks" TEXT,
  "general_status" TEXT,
  "status_date" TIMESTAMP(3),
  "employment_status" TEXT,
  "eoc_date" TIMESTAMP(3),
  "non_celebrant" BOOLEAN NOT NULL DEFAULT false,
  "sheet_row" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_records_sheet_row_key" ON "staff_records"("sheet_row");
CREATE INDEX IF NOT EXISTS "staff_records_user_id_idx" ON "staff_records"("user_id");
CREATE INDEX IF NOT EXISTS "staff_records_general_status_idx" ON "staff_records"("general_status");

DO $$ BEGIN
  ALTER TABLE "staff_records"
    ADD CONSTRAINT "staff_records_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
