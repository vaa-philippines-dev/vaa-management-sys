ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "short_name" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "acronym" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "level" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "departments_acronym_key" ON "departments"("acronym") WHERE "acronym" IS NOT NULL;
