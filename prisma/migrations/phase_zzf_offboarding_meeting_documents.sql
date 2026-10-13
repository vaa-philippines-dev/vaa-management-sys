-- Phase ZZF: end-of-contract meeting details + documents on offboarding cases
-- (Business Ops meeting, 2026-10-12).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffboardingMeetingDecision') THEN
    CREATE TYPE "OffboardingMeetingDecision" AS ENUM ('END_CONFIRMED', 'EXTENDED', 'REASSIGNED', 'OTHER');
  END IF;
END $$;

ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "meeting_date" TIMESTAMP(3);
ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "meeting_attendees" TEXT;
ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "meeting_recording_url" TEXT;
ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "meeting_notes" TEXT;
ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "meeting_decision" "OffboardingMeetingDecision";

CREATE TABLE IF NOT EXISTS "termination_documents" (
  "id" TEXT NOT NULL,
  "termination_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "added_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "termination_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "termination_documents_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "termination_documents_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "termination_documents_termination_id_idx" ON "termination_documents"("termination_id");
