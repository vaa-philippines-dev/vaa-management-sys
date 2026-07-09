-- Phase I migration: replace GeneralStatus (ACTIVE/INACTIVE/ON_HOLD) with an
-- expanded lifecycle enum (ACTIVE/PENDING/TRANSFERRED/RESIGNED/REMOVED/PROJECT_ENDED/CANCELLED)
-- and split ON_HOLD out into a standalone on_hold boolean on each affected table.
-- Affected tables: positions, users, role_assignments, va_profiles, clients.

-- 1. Add on_hold boolean columns, backfilled from existing ON_HOLD status rows.
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "on_hold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "on_hold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "role_assignments" ADD COLUMN IF NOT EXISTS "on_hold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "on_hold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "on_hold" BOOLEAN NOT NULL DEFAULT false;

UPDATE "positions" SET "on_hold" = true WHERE "general_status" = 'ON_HOLD';
UPDATE "users" SET "on_hold" = true WHERE "general_status" = 'ON_HOLD';
UPDATE "role_assignments" SET "on_hold" = true WHERE "general_status" = 'ON_HOLD';
UPDATE "va_profiles" SET "on_hold" = true WHERE "general_status" = 'ON_HOLD';
UPDATE "clients" SET "on_hold" = true WHERE "general_status" = 'ON_HOLD';

-- 2. Create the new enum type alongside the old one.
DO $$ BEGIN
  CREATE TYPE "GeneralStatus_new" AS ENUM (
    'ACTIVE', 'PENDING', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'PROJECT_ENDED', 'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Migrate each column: drop the default, cast via a mapping, apply the new type, restore default.
ALTER TABLE "positions" ALTER COLUMN "general_status" DROP DEFAULT;
ALTER TABLE "positions" ALTER COLUMN "general_status" TYPE "GeneralStatus_new" USING (
  CASE "general_status"::text
    WHEN 'INACTIVE' THEN 'RESIGNED'
    WHEN 'ON_HOLD' THEN 'ACTIVE'
    ELSE "general_status"::text
  END
)::"GeneralStatus_new";
ALTER TABLE "positions" ALTER COLUMN "general_status" SET DEFAULT 'ACTIVE';

ALTER TABLE "users" ALTER COLUMN "general_status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "general_status" TYPE "GeneralStatus_new" USING (
  CASE "general_status"::text
    WHEN 'INACTIVE' THEN 'RESIGNED'
    WHEN 'ON_HOLD' THEN 'ACTIVE'
    ELSE "general_status"::text
  END
)::"GeneralStatus_new";
ALTER TABLE "users" ALTER COLUMN "general_status" SET DEFAULT 'ACTIVE';

ALTER TABLE "role_assignments" ALTER COLUMN "general_status" DROP DEFAULT;
ALTER TABLE "role_assignments" ALTER COLUMN "general_status" TYPE "GeneralStatus_new" USING (
  CASE "general_status"::text
    WHEN 'INACTIVE' THEN 'RESIGNED'
    WHEN 'ON_HOLD' THEN 'ACTIVE'
    ELSE "general_status"::text
  END
)::"GeneralStatus_new";
ALTER TABLE "role_assignments" ALTER COLUMN "general_status" SET DEFAULT 'ACTIVE';

ALTER TABLE "va_profiles" ALTER COLUMN "general_status" DROP DEFAULT;
ALTER TABLE "va_profiles" ALTER COLUMN "general_status" TYPE "GeneralStatus_new" USING (
  CASE "general_status"::text
    WHEN 'INACTIVE' THEN 'RESIGNED'
    WHEN 'ON_HOLD' THEN 'ACTIVE'
    ELSE "general_status"::text
  END
)::"GeneralStatus_new";
ALTER TABLE "va_profiles" ALTER COLUMN "general_status" SET DEFAULT 'ACTIVE';

ALTER TABLE "clients" ALTER COLUMN "general_status" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "general_status" TYPE "GeneralStatus_new" USING (
  CASE "general_status"::text
    WHEN 'INACTIVE' THEN 'RESIGNED'
    WHEN 'ON_HOLD' THEN 'ACTIVE'
    ELSE "general_status"::text
  END
)::"GeneralStatus_new";
ALTER TABLE "clients" ALTER COLUMN "general_status" SET DEFAULT 'ACTIVE';

-- 4. Swap the enum type names so the new type takes over "GeneralStatus".
DROP TYPE "GeneralStatus";
ALTER TYPE "GeneralStatus_new" RENAME TO "GeneralStatus";
