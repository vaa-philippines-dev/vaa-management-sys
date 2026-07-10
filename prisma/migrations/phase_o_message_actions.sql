-- Phase O: message edit/reply/pin/delete/forward support.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MESSAGE_REPLY';

ALTER TABLE "public"."messages"
  ADD COLUMN "edited_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "parent_id" TEXT,
  ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinned_at" TIMESTAMP(3),
  ADD COLUMN "pinned_by" TEXT,
  ADD COLUMN "forwarded_from_id" TEXT,
  ADD COLUMN "forwarded_from_body" TEXT,
  ADD COLUMN "forwarded_from_sender_name" TEXT;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_pinned_by_fkey"
  FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "messages_parent_id_idx" ON "public"."messages" ("parent_id");
CREATE INDEX "messages_channel_id_pinned_idx" ON "public"."messages" ("channel_id", "pinned");

ALTER TABLE "public"."notifications"
  ADD COLUMN "message_id" TEXT,
  ADD COLUMN "mentioner_name" TEXT,
  ADD COLUMN "department_name" TEXT;
