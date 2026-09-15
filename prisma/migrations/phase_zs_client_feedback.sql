-- Phase ZS migration: the client-feedback half of the DMF sheet's
-- "Performance Monitoring" tab. The check-in milestones (D4/W1/W2/M1/M2/M3/
-- M6) are already assignment_kpi_checks; at the W2 and M6 milestones the
-- department also emails the client for feedback on the VA, chases a
-- response, and relays it back — a cycle with its own state, hence its own
-- table rather than more columns on assignment_kpi_checks.

CREATE TYPE "FeedbackWindow" AS ENUM ('W2', 'M6');
CREATE TYPE "ClientResponseStatus" AS ENUM ('NOT_SENT', 'AWAITING_RESPONSE', 'RESPONDED', 'NO_RESPONSE', 'DECLINED');

CREATE TABLE "assignment_client_feedback" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "feedback_window" "FeedbackWindow" NOT NULL,
    "requested" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),
    "response_status" "ClientResponseStatus" NOT NULL DEFAULT 'NOT_SENT',
    "received_at" TIMESTAMP(3),
    "feedback" TEXT,
    "relayed_to_va" BOOLEAN NOT NULL DEFAULT false,
    "relayed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_client_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assignment_client_feedback_assignment_id_feedback_window_key" ON "assignment_client_feedback"("assignment_id", "feedback_window");
CREATE INDEX "assignment_client_feedback_response_status_idx" ON "assignment_client_feedback"("response_status");

ALTER TABLE "assignment_client_feedback" ADD CONSTRAINT "assignment_client_feedback_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
