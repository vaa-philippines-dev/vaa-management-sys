-- Phase Q: Direct Messages, #announcements channel, dedicated MessageColor enum.

CREATE TYPE "ChannelKind" AS ENUM ('DEPARTMENT', 'DIRECT', 'ANNOUNCEMENTS');
CREATE TYPE "MessageColor" AS ENUM ('BLUE', 'RED', 'GREEN', 'YELLOW', 'BLACK');

ALTER TABLE "public"."channels" ALTER COLUMN "department_id" DROP NOT NULL;
DROP INDEX IF EXISTS "channels_department_id_key";
CREATE UNIQUE INDEX "channels_department_id_key" ON "public"."channels" ("department_id") WHERE "department_id" IS NOT NULL;

ALTER TABLE "public"."channels"
  ADD COLUMN "kind" "ChannelKind" NOT NULL DEFAULT 'DEPARTMENT',
  ADD COLUMN "dm_key" TEXT;

CREATE UNIQUE INDEX "channels_dm_key_key" ON "public"."channels" ("dm_key");

CREATE TABLE "public"."channel_participants" (
  "id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "channel_participants_channel_id_user_id_key" ON "public"."channel_participants" ("channel_id", "user_id");
CREATE INDEX "channel_participants_user_id_idx" ON "public"."channel_participants" ("user_id");
ALTER TABLE "public"."channel_participants"
  ADD CONSTRAINT "channel_participants_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."channel_participants"
  ADD CONSTRAINT "channel_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."users" ALTER COLUMN "message_color" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "message_color" TYPE "MessageColor" USING ("message_color"::text::"MessageColor");
ALTER TABLE "public"."users" ALTER COLUMN "message_color" SET DEFAULT 'BLUE';

-- One-time: create the single #announcements channel if it doesn't already exist.
INSERT INTO "public"."channels" ("id", "kind", "created_at")
SELECT gen_random_uuid()::text, 'ANNOUNCEMENTS', now()
WHERE NOT EXISTS (SELECT 1 FROM "public"."channels" WHERE "kind" = 'ANNOUNCEMENTS');
