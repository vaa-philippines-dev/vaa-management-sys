-- Phase H migration: split name parts, birthday celebrant flag, recommendability, address line

-- 1. Users: split name parts
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "middle_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ext_name" TEXT;

-- 2. User profiles: birthday celebrant flag + address line
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "birthday_celebrant" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "address_line" TEXT;

-- 3. VA profiles: recommendability
ALTER TABLE "va_profiles" ADD COLUMN IF NOT EXISTS "recommendability" TEXT;
