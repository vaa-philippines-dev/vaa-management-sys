-- Phase ZA migration: raw mirror table for the VAConnections sheet ("load"
-- phase only). Every sheet row with a ConnectionID lands here as-is on each
-- sync run. Turning a row into a real Assignment (VA/Client mapping) is a
-- separate, not-yet-wired-in phase — this table has no FK into vaProfiles/
-- clients on purpose.

CREATE TABLE IF NOT EXISTS "va_connection_records" (
  "id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "connection_type" TEXT,
  "va_external_id" TEXT,
  "va_name" TEXT,
  "client_external_id" TEXT,
  "client_name" TEXT,
  "department" TEXT,
  "service" TEXT,
  "hours" TEXT,
  "hours_type" TEXT,
  "connection_date" TEXT,
  "start_date" TEXT,
  "termination_date" TEXT,
  "notes" TEXT,
  "raw" JSONB NOT NULL,
  "last_synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "va_connection_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "va_connection_records_connection_id_key" ON "va_connection_records"("connection_id");
CREATE INDEX IF NOT EXISTS "va_connection_records_status_idx" ON "va_connection_records"("status");
CREATE INDEX IF NOT EXISTS "va_connection_records_va_name_idx" ON "va_connection_records"("va_name");
CREATE INDEX IF NOT EXISTS "va_connection_records_client_name_idx" ON "va_connection_records"("client_name");
