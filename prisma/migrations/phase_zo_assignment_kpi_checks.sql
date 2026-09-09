-- Phase ZO migration: the DMF sheet's "Performance Monitoring" tab — 7 fixed
-- check-in milestones per assignment (Day 4 / Week 1 / Week 2 / Month 1/2/3/6),
-- each a due date plus a manually-set completed flag. Ported directly from
-- the sheet's own formulas (WORKDAY/EDATE-based date math) rather than
-- reinvented.

CREATE TYPE "KpiMilestone" AS ENUM ('D4', 'W1', 'W2', 'M1', 'M2', 'M3', 'M6');

CREATE TABLE "assignment_kpi_checks" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "milestone" "KpiMilestone" NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_kpi_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assignment_kpi_checks_assignment_id_milestone_key" ON "assignment_kpi_checks"("assignment_id", "milestone");
CREATE INDEX "assignment_kpi_checks_due_date_idx" ON "assignment_kpi_checks"("due_date");
CREATE INDEX "assignment_kpi_checks_completed_idx" ON "assignment_kpi_checks"("completed");

ALTER TABLE "assignment_kpi_checks" ADD CONSTRAINT "assignment_kpi_checks_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_kpi_checks" ADD CONSTRAINT "assignment_kpi_checks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
