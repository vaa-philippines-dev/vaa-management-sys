-- Phase ZV migration: per-department VA availability (DMF block) plus the
-- Team Leader's TMF block. Until now remarks / recommendation / review dates
-- lived on va_profiles, so a VA in two departments had one shared set that
-- each department's manager overwrote in turn.
--
-- Backfill: every existing value was written by exactly one department's DMF
-- (import or /va-availability edit), but va_profiles doesn't record which.
-- It's copied into the VA's primary department only (first active
-- membership when none is primary) — copying it into every department would
-- recreate the very collision this table exists to remove. The va_profiles
-- columns are left in place, unread, rather than dropped.

CREATE TABLE "va_department_availability" (
  "id" TEXT NOT NULL,
  "va_profile_id" TEXT NOT NULL,
  "department_id" TEXT NOT NULL,
  "availability_status" "Availability",
  "remarks" TEXT,
  "changed_at" TIMESTAMP(3),
  "review_due_at" TIMESTAMP(3),
  "is_recommended" BOOLEAN NOT NULL DEFAULT false,
  "recommended_for_client" TEXT,
  "recommended_until" TEXT,
  "tmf_availability_status" "Availability",
  "tmf_remarks" TEXT,
  "tmf_changed_at" TIMESTAMP(3),
  "tmf_review_due_at" TIMESTAMP(3),
  "tmf_updated_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "va_department_availability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "va_department_availability_va_profile_id_department_id_key"
  ON "va_department_availability"("va_profile_id", "department_id");
CREATE INDEX "va_department_availability_department_id_idx"
  ON "va_department_availability"("department_id");

ALTER TABLE "va_department_availability"
  ADD CONSTRAINT "va_department_availability_va_profile_id_fkey"
    FOREIGN KEY ("va_profile_id") REFERENCES "va_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "va_department_availability_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "va_department_availability_tmf_updated_by_id_fkey"
    FOREIGN KEY ("tmf_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "va_department_availability" (
  "id", "va_profile_id", "department_id",
  "remarks", "changed_at", "review_due_at",
  "is_recommended", "recommended_for_client", "recommended_until",
  "updated_at"
)
SELECT
  'vda_' || md5(p.id || home.department_id),
  p.id, home.department_id,
  p.availability_remarks, p.availability_changed_at, p.availability_review_due_at,
  p.is_recommended, p.recommended_for_client, p.recommended_until,
  CURRENT_TIMESTAMP
FROM "va_profiles" p
JOIN LATERAL (
  SELECT dm.department_id
  FROM "department_memberships" dm
  WHERE dm.user_id = p.user_id AND dm.ended_at IS NULL
  ORDER BY dm.is_primary DESC, dm.started_at ASC
  LIMIT 1
) home ON true
WHERE p.availability_remarks IS NOT NULL
   OR p.availability_changed_at IS NOT NULL
   OR p.availability_review_due_at IS NOT NULL
   OR p.is_recommended
   OR p.recommended_for_client IS NOT NULL
   OR p.recommended_until IS NOT NULL
ON CONFLICT ("va_profile_id", "department_id") DO NOTHING;
