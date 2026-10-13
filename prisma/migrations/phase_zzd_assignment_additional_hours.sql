-- Phase ZZD: additional hours on an existing engagement (Business Ops meeting,
-- 2026-10-12). An add-on is its own Assignment linked to the one it extends.
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "parent_assignment_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_parent_assignment_id_fkey'
  ) THEN
    ALTER TABLE "assignments"
      ADD CONSTRAINT "assignments_parent_assignment_id_fkey"
      FOREIGN KEY ("parent_assignment_id") REFERENCES "assignments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "assignments_parent_assignment_id_idx" ON "assignments"("parent_assignment_id");
