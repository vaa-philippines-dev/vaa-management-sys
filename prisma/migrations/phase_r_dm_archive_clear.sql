-- Phase R: archive + per-user clear-conversation for Direct Messages.

ALTER TABLE "public"."channel_participants"
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cleared_at" TIMESTAMP(3);
