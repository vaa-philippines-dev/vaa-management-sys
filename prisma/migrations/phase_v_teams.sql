-- Phase V migration: add "teams" and "team_memberships" tables backing the
-- new Teams feature (Team Leader + up to 2 Temp Leaders as direct FKs on
-- Team; membership is a soft-closable join table mirroring
-- department_memberships — never hard-delete, just close old rows).

CREATE TABLE IF NOT EXISTS "teams" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department_id" TEXT NOT NULL,
  "leader_id" TEXT,
  "temp_leader1_id" TEXT,
  "temp_leader2_id" TEXT,
  "general_status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "on_hold" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "team_memberships" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teams_name_department_id_key" ON "teams"("name", "department_id");
CREATE INDEX IF NOT EXISTS "teams_department_id_idx" ON "teams"("department_id");
CREATE INDEX IF NOT EXISTS "teams_leader_id_idx" ON "teams"("leader_id");

CREATE INDEX IF NOT EXISTS "team_memberships_team_id_user_id_idx" ON "team_memberships"("team_id", "user_id");
CREATE INDEX IF NOT EXISTS "team_memberships_user_id_idx" ON "team_memberships"("user_id");

DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_fkey"
    FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_temp_leader1_id_fkey"
    FOREIGN KEY ("temp_leader1_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_temp_leader2_id_fkey"
    FOREIGN KEY ("temp_leader2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
