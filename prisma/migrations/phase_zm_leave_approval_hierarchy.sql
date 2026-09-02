-- Phase ZM migration: Staff Leave Management approval hierarchy, requested
-- by a manager to route leave requests through a configurable, role-based
-- approval chain (e.g. Team Leader -> Dept Head + HR; Dept Manager -> HR +
-- named COM/COO). Redesigns the previously-unused single-approver
-- LeaveRequest model into a multi-step, multi-approver workflow.
--
-- Recorded here for history per this repo's convention, even though it was
-- actually applied via `prisma db push --accept-data-loss` rather than this
-- file directly: `db push` applied every step below successfully before
-- failing on unrelated, pre-existing schema drift further down its plan
-- (a dangling `departments_name_parent_id_key` index untracked by Prisma's
-- introspection) — confirmed applied correctly via `prisma db pull --print`.

CREATE TYPE "ApproverResolution" AS ENUM ('DEPARTMENT_HEAD', 'ROLE', 'SPECIFIC_USER');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_APPROVAL_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_DECIDED';

CREATE TABLE "leave_approval_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "submitter_role" "SystemRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_approval_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_approval_rules_submitter_role_key" ON "leave_approval_rules"("submitter_role");

CREATE TABLE "leave_approval_steps" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "resolution" "ApproverResolution" NOT NULL,
    "approver_role" "SystemRole",
    "approver_user_id" TEXT,
    "require_all" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_approval_steps_rule_id_idx" ON "leave_approval_steps"("rule_id");

ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "leave_approval_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "approver_id";
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "approved_at";
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "approver_note";
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "notification_sent";
ALTER TABLE "leave_requests" ADD COLUMN "current_step" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "leave_requests" ADD COLUMN "rule_id" TEXT;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "leave_approval_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "leave_approval_actions" (
    "id" TEXT NOT NULL,
    "leave_request_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_id" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_approval_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_approval_actions_leave_request_id_approver_id_key" ON "leave_approval_actions"("leave_request_id", "approver_id");
CREATE INDEX IF NOT EXISTS "leave_approval_actions_leave_request_id_idx" ON "leave_approval_actions"("leave_request_id");

ALTER TABLE "leave_approval_actions" ADD CONSTRAINT "leave_approval_actions_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_approval_actions" ADD CONSTRAINT "leave_approval_actions_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
