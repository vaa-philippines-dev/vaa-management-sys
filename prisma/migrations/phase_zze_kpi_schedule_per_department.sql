-- Phase ZZE: per-department KPI check-in schedule (FB-0015) — a Day 1
-- milestone, and the list of milestones each department runs (empty = the
-- DMF sheet's default seven).
ALTER TYPE "KpiMilestone" ADD VALUE IF NOT EXISTS 'D1' BEFORE 'D4';
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "kpi_milestones" "KpiMilestone"[] NOT NULL DEFAULT ARRAY[]::"KpiMilestone"[];
