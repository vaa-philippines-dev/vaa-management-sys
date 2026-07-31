-- Phase ZG migration: VA self-service onboarding invites. HR creates a VA
-- with basic info, then generates a unique time-limited token; the VA opens
-- /onboard/[token] (no login) to fill in the rest of their own profile.

CREATE TABLE IF NOT EXISTS "va_onboarding_invites" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "va_onboarding_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "va_onboarding_invites_user_id_key" ON "va_onboarding_invites"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "va_onboarding_invites_token_key" ON "va_onboarding_invites"("token");

DO $$ BEGIN
  ALTER TABLE "va_onboarding_invites"
    ADD CONSTRAINT "va_onboarding_invites_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "va_onboarding_invites"
    ADD CONSTRAINT "va_onboarding_invites_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
