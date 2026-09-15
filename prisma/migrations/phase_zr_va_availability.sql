-- Phase ZR migration: the DMF sheet's "VA Availability" tab. Only the columns
-- with no other source are added — CURRENT WORK HOURS, AVAILABLE WORK HOURS
-- and CLIENT COUNT are derived from the VA's active assignments instead of
-- being stored, since the sheet maintains those three by hand and this app
-- can compute them exactly (see lib/va-availability.ts).

ALTER TABLE "va_profiles"
  ADD COLUMN "hybrid_hours" DECIMAL(65,30),
  ADD COLUMN "is_recommended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recommended_for_client" TEXT,
  ADD COLUMN "recommended_until" TEXT,
  ADD COLUMN "availability_remarks" TEXT,
  ADD COLUMN "availability_changed_at" TIMESTAMP(3),
  ADD COLUMN "availability_review_due_at" TIMESTAMP(3);

CREATE INDEX "va_profiles_is_recommended_idx" ON "va_profiles"("is_recommended");
CREATE INDEX "va_profiles_availability_review_due_at_idx" ON "va_profiles"("availability_review_due_at");
