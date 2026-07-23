-- Phase ZD migration: adds the fields needed for the full client-intake
-- form (Meeting Date + Request/Customer/Company/Other Information
-- categories). A handful of clearly reportable fields (request type,
-- business model, service type, secondary contact, meeting/target-start
-- dates) get real columns; the rest of the non-department-varying form
-- content (brand/product info, marketplace, schedule, VA requirements,
-- etc.) goes into the new form_details JSON column. Department-varying
-- "Account Information" fields continue to use the existing
-- intake_details column — this migration doesn't touch that.

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "request_type" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "business_model" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "service_type" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "secondary_contact" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "meeting_date" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "target_start_date" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "form_details" JSONB;
