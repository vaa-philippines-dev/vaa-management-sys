-- Phase ZH migration: AI agent tables (lead-to-sales pipeline + VA matching).
--
-- These are written by the separate `vaa-agent` service and read by this app's
-- review UI. This repo owns the migration; vaa-agent introspects (`prisma db
-- pull`) and never migrates, so there is exactly one migration history over
-- this database.

-- ── Enums ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ClientPipelineStage" AS ENUM ('SIGNED', 'ONBOARDING', 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentSuggestionKind" AS ENUM (
    'VA_MATCH', 'NO_MATCH_FOUND', 'ONBOARDING_CHECKLIST', 'WELCOME_MESSAGE', 'STALLED_HANDOFF'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentSuggestionStatus" AS ENUM (
    'PENDING', 'APPROVED', 'EDITED', 'REJECTED', 'SUPERSEDED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── agent_runs ───────────────────────────────────────────────────
-- Created before agent_suggestions because suggestions reference it.

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "items_processed" INTEGER NOT NULL DEFAULT 0,
  "suggestions_made" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "trace" JSONB,

  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_runs_job_started_at_idx" ON "agent_runs"("job", "started_at");
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs"("status");

-- ── client_pipelines ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "client_pipelines" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "stage" "ClientPipelineStage" NOT NULL DEFAULT 'SIGNED',
  "stage_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stalled_at" TIMESTAMP(3),
  "signed_trigger" TEXT,
  "signed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_pipelines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_pipelines_client_id_key" ON "client_pipelines"("client_id");
CREATE INDEX IF NOT EXISTS "client_pipelines_stage_stage_entered_at_idx" ON "client_pipelines"("stage", "stage_entered_at");
CREATE INDEX IF NOT EXISTS "client_pipelines_stalled_at_idx" ON "client_pipelines"("stalled_at");

DO $$ BEGIN
  ALTER TABLE "client_pipelines"
    ADD CONSTRAINT "client_pipelines_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── agent_suggestions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "agent_suggestions" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "kind" "AgentSuggestionKind" NOT NULL,
  "status" "AgentSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "client_id" TEXT,
  "va_profile_id" TEXT,
  "rank" INTEGER,
  "score" DECIMAL(5,2),
  "rationale" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "decided_by_id" TEXT,
  "decided_at" TIMESTAMP(3),
  "edited_payload" JSONB,
  "decision_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_suggestions_status_kind_created_at_idx" ON "agent_suggestions"("status", "kind", "created_at");
CREATE INDEX IF NOT EXISTS "agent_suggestions_client_id_kind_idx" ON "agent_suggestions"("client_id", "kind");
CREATE INDEX IF NOT EXISTS "agent_suggestions_va_profile_id_idx" ON "agent_suggestions"("va_profile_id");
CREATE INDEX IF NOT EXISTS "agent_suggestions_run_id_idx" ON "agent_suggestions"("run_id");

DO $$ BEGIN
  ALTER TABLE "agent_suggestions"
    ADD CONSTRAINT "agent_suggestions_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_suggestions"
    ADD CONSTRAINT "agent_suggestions_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_suggestions"
    ADD CONSTRAINT "agent_suggestions_va_profile_id_fkey"
    FOREIGN KEY ("va_profile_id") REFERENCES "va_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- A rejected/edited suggestion is kept forever as feedback, so decided_by is
-- nulled rather than cascaded when the deciding staff member is removed.
DO $$ BEGIN
  ALTER TABLE "agent_suggestions"
    ADD CONSTRAINT "agent_suggestions_decided_by_id_fkey"
    FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
