-- Phase ZB migration: adds a flexible JSON column to clients for
-- department-specific intake form data (e.g. Amazon: account background +
-- goals; PPC: account background + campaign background + goals +
-- advertising budget). Each department's field set is defined in app code,
-- not the schema, so new departments/fields never require a migration.

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "intake_details" JSONB;
