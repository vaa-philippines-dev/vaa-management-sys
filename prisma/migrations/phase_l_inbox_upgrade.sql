-- Phase L: Inbox upgrade (mentions, per-user bubble color, per-channel read tracking)

ALTER TABLE "public"."users"
  ADD COLUMN "message_color" "FavoriteColor" NOT NULL DEFAULT 'BLUE';

CREATE TABLE "public"."message_mentions" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "mentioned_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_mentions_mentioned_user_id_idx" ON "public"."message_mentions" ("mentioned_user_id");

ALTER TABLE "public"."message_mentions"
  ADD CONSTRAINT "message_mentions_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."message_mentions"
  ADD CONSTRAINT "message_mentions_mentioned_user_id_fkey"
  FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."channel_reads" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "channel_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_reads_user_id_channel_id_key" ON "public"."channel_reads" ("user_id", "channel_id");

ALTER TABLE "public"."channel_reads"
  ADD CONSTRAINT "channel_reads_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."channel_reads"
  ADD CONSTRAINT "channel_reads_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
