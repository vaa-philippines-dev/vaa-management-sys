-- Phase K: Messaging (department channels, Slack/Discord-style internal chat)

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_MESSAGE';

CREATE TABLE "public"."channels" (
  "id" TEXT NOT NULL,
  "department_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channels_department_id_key" ON "public"."channels" ("department_id");

ALTER TABLE "public"."channels"
  ADD CONSTRAINT "channels_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."messages" (
  "id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_channel_id_created_at_idx" ON "public"."messages" ("channel_id", "created_at");

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Supabase Realtime so channel views receive live message inserts.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Backfill: create a channel for every existing department.
INSERT INTO "public"."channels" ("id", "department_id")
SELECT gen_random_uuid()::text, "id" FROM "public"."departments"
ON CONFLICT DO NOTHING;
