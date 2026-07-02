-- Phase A2 migration: Create DepartmentSkill junction table
CREATE TABLE IF NOT EXISTS "department_skills" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "department_id" TEXT NOT NULL,
  "skill_id" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "department_skills_department_id_fkey" FOREIGN KEY ("department_id")
    REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "department_skills_skill_id_fkey" FOREIGN KEY ("skill_id")
    REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "department_skills_department_id_skill_id_key"
  ON "department_skills"("department_id", "skill_id");
