-- Phase P: carry the mentioner's avatar into the notification row so the
-- mention toast can render it without a second lookup.

ALTER TABLE "public"."notifications"
  ADD COLUMN "mentioner_avatar_url" TEXT;
