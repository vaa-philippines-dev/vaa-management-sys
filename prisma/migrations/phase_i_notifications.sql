-- Phase I: Notification model (in-app notifications for VA assignments and hours shortfalls)

CREATE TYPE "NotificationType" AS ENUM ('NEW_ASSIGNMENT', 'HOURS_SHORTFALL');

CREATE TABLE "public"."notifications" (
  "id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipient_id_read_created_at_idx"
  ON "public"."notifications" ("recipient_id", "read", "created_at");

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Supabase Realtime so the NotificationBell UI receives live inserts.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
