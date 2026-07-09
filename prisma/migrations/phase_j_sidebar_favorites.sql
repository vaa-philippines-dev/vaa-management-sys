-- Phase J: Sidebar favorites (starred sections + one Featured Favorite that redirects on entry)

CREATE TYPE "FavoriteColor" AS ENUM ('YELLOW', 'BLUE', 'RED');

CREATE TABLE "public"."sidebar_favorites" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "color" "FavoriteColor" NOT NULL,
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sidebar_favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sidebar_favorites_user_id_href_key"
  ON "public"."sidebar_favorites" ("user_id", "href");

CREATE INDEX "sidebar_favorites_user_id_idx"
  ON "public"."sidebar_favorites" ("user_id");

ALTER TABLE "public"."sidebar_favorites"
  ADD CONSTRAINT "sidebar_favorites_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
