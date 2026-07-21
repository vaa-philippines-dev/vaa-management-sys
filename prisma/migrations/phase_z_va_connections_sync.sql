-- Phase Z migration: backs the VAConnections Google Sheet import.
-- Adds source/externalId/syncedAt to assignments (idempotent upsert key +
-- Option A UI lock for synced records) and a generic external_sync_mappings
-- table used to bootstrap-resolve the sheet's VAID/ClientID into this app's
-- VAProfile/Client records.

DO $$ BEGIN
  CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'VA_CONNECTIONS_SYNC');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SyncEntityType" AS ENUM ('VA_PROFILE', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "external_id" TEXT;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "assignments_external_id_key" ON "assignments"("external_id");

CREATE TABLE IF NOT EXISTS "external_sync_mappings" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'va_connections_sheet',
  "entity_type" "SyncEntityType" NOT NULL,
  "external_id" TEXT NOT NULL,
  "internal_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_sync_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_sync_mappings_source_entity_type_external_id_key"
  ON "external_sync_mappings"("source", "entity_type", "external_id");
CREATE INDEX IF NOT EXISTS "external_sync_mappings_internal_id_idx" ON "external_sync_mappings"("internal_id");
