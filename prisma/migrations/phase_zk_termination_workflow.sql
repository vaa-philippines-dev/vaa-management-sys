-- Phase ZK migration: termination workflow requested in the 2026-08-04
-- Workforce System Feedback Review Meeting. A "Terminate" action generates
-- a system Ticket (category TERMINATION) instead of a raw status dropdown,
-- classified Type A (EOC) / B (client-initiated) / C (VAA-initiated), plus a
-- token-based public exit survey and a clearance checklist — mirroring the
-- VAOnboardingInvite pattern already used for VA onboarding.

-- The TicketCategory.TERMINATION enum value is added by
-- phase_zk0_ticket_category_termination.sql, run before this file, since
-- ALTER TYPE ... ADD VALUE cannot share a transaction with statements that
-- reference the new value.

CREATE TYPE "TerminationType" AS ENUM ('EOC', 'CLIENT_INITIATED', 'VAA_INITIATED');
CREATE TYPE "TerminationWorkflowStatus" AS ENUM ('INITIATED', 'EXIT_SURVEY_PENDING', 'CLEARANCE_PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "terminations" (
    "id" TEXT NOT NULL,
    "va_profile_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "type" "TerminationType" NOT NULL,
    "affects_both_parties" BOOLEAN NOT NULL DEFAULT false,
    "resulting_status" "EmploymentStatus" NOT NULL,
    "reason" TEXT,
    "workflow_status" "TerminationWorkflowStatus" NOT NULL DEFAULT 'INITIATED',
    "ticket_id" TEXT,
    "resignation_doc_url" TEXT,
    "initiated_by_id" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "terminations_ticket_id_key" ON "terminations"("ticket_id");
CREATE INDEX IF NOT EXISTS "terminations_va_profile_id_idx" ON "terminations"("va_profile_id");
CREATE INDEX IF NOT EXISTS "terminations_assignment_id_idx" ON "terminations"("assignment_id");
CREATE INDEX IF NOT EXISTS "terminations_workflow_status_idx" ON "terminations"("workflow_status");

ALTER TABLE "terminations" ADD CONSTRAINT "terminations_va_profile_id_fkey" FOREIGN KEY ("va_profile_id") REFERENCES "va_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "exit_survey_invites" (
    "id" TEXT NOT NULL,
    "termination_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exit_survey_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exit_survey_invites_termination_id_key" ON "exit_survey_invites"("termination_id");
CREATE UNIQUE INDEX IF NOT EXISTS "exit_survey_invites_token_key" ON "exit_survey_invites"("token");

ALTER TABLE "exit_survey_invites" ADD CONSTRAINT "exit_survey_invites_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "exit_survey_responses" (
    "id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "reason_for_leaving" TEXT,
    "feedback" TEXT,
    "would_recommend" BOOLEAN,
    "additional_comments" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exit_survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exit_survey_responses_invite_id_key" ON "exit_survey_responses"("invite_id");

ALTER TABLE "exit_survey_responses" ADD CONSTRAINT "exit_survey_responses_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "exit_survey_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "exit_clearances" (
    "id" TEXT NOT NULL,
    "termination_id" TEXT NOT NULL,
    "equipment_returned" BOOLEAN NOT NULL DEFAULT false,
    "accounts_revoked" BOOLEAN NOT NULL DEFAULT false,
    "documents_submitted" BOOLEAN NOT NULL DEFAULT false,
    "final_pay_cleared" BOOLEAN NOT NULL DEFAULT false,
    "outstanding_balance_note" TEXT,
    "cleared_by_id" TEXT,
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_clearances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exit_clearances_termination_id_key" ON "exit_clearances"("termination_id");

ALTER TABLE "exit_clearances" ADD CONSTRAINT "exit_clearances_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exit_clearances" ADD CONSTRAINT "exit_clearances_cleared_by_id_fkey" FOREIGN KEY ("cleared_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
