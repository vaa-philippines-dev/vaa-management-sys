-- Phase ZQ migration: the DMF sheet's "VA Preparation" tab — the pre-launch
-- pipeline for one VA-client engagement (client meeting -> preparation call
-- -> mock interview -> VA connect -> a nine-item onboarding checklist ->
-- live), plus the tab's own EOC/pause block. 1:1 with assignments, since the
-- sheet's RECORD NO key is what an Assignment already is in this app.

CREATE TYPE "PreparationStartStatus" AS ENUM ('NOT_YET_STARTED', 'STARTED_ON_TIME', 'DELAYED', 'CANCELLED');
CREATE TYPE "PreparationVaType" AS ENUM ('NEW', 'ADDITIONAL', 'REPLACEMENT');
CREATE TYPE "PreparationStepStatus" AS ENUM ('PENDING', 'SCHEDULED', 'DONE', 'SKIPPED');
CREATE TYPE "PreparationClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'END_OF_WORK');

CREATE TABLE "assignment_preparations" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "start_status" "PreparationStartStatus" NOT NULL DEFAULT 'NOT_YET_STARTED',
    "target_start_date" TIMESTAMP(3),
    "va_type" "PreparationVaType" NOT NULL DEFAULT 'NEW',
    "schedule_type" TEXT,
    "schedule_days" TEXT,
    "expertise_group" TEXT,
    "va_buffers" TEXT,
    "va_client_file_url" TEXT,
    "account_doc_url" TEXT,
    "replacement_for_id" TEXT,
    "person_in_charge_id" TEXT,
    "shadow_trainer_id" TEXT,
    "client_meeting_date" TIMESTAMP(3),
    "client_meeting_status" "PreparationStepStatus" NOT NULL DEFAULT 'PENDING',
    "preparation_start_date" TIMESTAMP(3),
    "preparation_end_date" TIMESTAMP(3),
    "preparation_call_date" TIMESTAMP(3),
    "preparation_call_status" "PreparationStepStatus" NOT NULL DEFAULT 'PENDING',
    "mock_interview_date" TIMESTAMP(3),
    "mock_interview_status" "PreparationStepStatus" NOT NULL DEFAULT 'PENDING',
    "va_connect_date" TIMESTAMP(3),
    "va_connect_status" "PreparationStepStatus" NOT NULL DEFAULT 'PENDING',
    "announcement_email" BOOLEAN NOT NULL DEFAULT false,
    "client_briefing_call" BOOLEAN NOT NULL DEFAULT false,
    "cs_briefing" BOOLEAN NOT NULL DEFAULT false,
    "vaa_background" BOOLEAN NOT NULL DEFAULT false,
    "email_signature" BOOLEAN NOT NULL DEFAULT false,
    "group_chat" BOOLEAN NOT NULL DEFAULT false,
    "milestone_folder" BOOLEAN NOT NULL DEFAULT false,
    "weekly_report" BOOLEAN NOT NULL DEFAULT false,
    "portfolio" BOOLEAN NOT NULL DEFAULT false,
    "client_status" "PreparationClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectivity_date" TIMESTAMP(3),
    "status_reason" TEXT,
    "replacement_note" TEXT,
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_preparations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assignment_preparations_assignment_id_key" ON "assignment_preparations"("assignment_id");
CREATE INDEX "assignment_preparations_start_status_idx" ON "assignment_preparations"("start_status");
CREATE INDEX "assignment_preparations_client_status_idx" ON "assignment_preparations"("client_status");
CREATE INDEX "assignment_preparations_target_start_date_idx" ON "assignment_preparations"("target_start_date");

ALTER TABLE "assignment_preparations" ADD CONSTRAINT "assignment_preparations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_preparations" ADD CONSTRAINT "assignment_preparations_replacement_for_id_fkey" FOREIGN KEY ("replacement_for_id") REFERENCES "va_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignment_preparations" ADD CONSTRAINT "assignment_preparations_person_in_charge_id_fkey" FOREIGN KEY ("person_in_charge_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignment_preparations" ADD CONSTRAINT "assignment_preparations_shadow_trainer_id_fkey" FOREIGN KEY ("shadow_trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignment_preparations" ADD CONSTRAINT "assignment_preparations_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "va_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
