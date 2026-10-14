-- Phase ZZG: assignment status history (pause/reactivate with dates and a
-- reason, cancelled date) — colleague request 2026-10-14.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssignmentStatusReason') THEN
    CREATE TYPE "AssignmentStatusReason" AS ENUM ('CLIENT_PAYMENT_FAILURE', 'CLIENT_REQUEST', 'VA_REQUEST', 'OTHER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "assignment_status_events" (
  "id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "from_status" "AssignmentStatus" NOT NULL,
  "to_status" "AssignmentStatus" NOT NULL,
  "effective_date" TIMESTAMP(3) NOT NULL,
  "reason" "AssignmentStatusReason",
  "note" TEXT,
  "actor_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_status_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assignment_status_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assignment_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "assignment_status_events_assignment_id_effective_date_idx" ON "assignment_status_events"("assignment_id", "effective_date");
