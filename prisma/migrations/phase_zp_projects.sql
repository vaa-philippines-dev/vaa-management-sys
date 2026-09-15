-- Phase ZP migration: the DMF sheet's "Projects/Proposals" tab — department
-- owned internal initiatives (programs, trainings, budget requests, internal
-- tooling) tracked through a review/approval cycle. Not client work: no
-- Client/Assignment link by design.

CREATE TYPE "ProjectStatus" AS ENUM ('FOR_REVIEW', 'FOR_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DECLINED');
CREATE TYPE "ProjectPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'CRITICAL');

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'FOR_REVIEW',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'NORMAL',
    "proposed_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "proposal_file_name" TEXT,
    "proposal_file_url" TEXT,
    "reference_notes" TEXT,
    "remarks" TEXT,
    "department_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_department_id_status_idx" ON "projects"("department_id", "status");
CREATE INDEX "projects_proposed_date_idx" ON "projects"("proposed_date");

ALTER TABLE "projects" ADD CONSTRAINT "projects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
