-- Phase M: Grant SELECT to authenticated + enable RLS so Supabase Realtime
-- (Postgres Changes) can actually read row data on INSERT for tables the
-- browser subscribes to, without opening these tables to the public anon key.
--
-- Without the grant, Realtime detects the change via WAL but returns an empty
-- payload, since the connecting client role has no privilege to read the row.
-- RLS stays enabled with a simple "must be logged in" policy — every read in
-- this app already goes through Prisma (connecting as postgres, bypassing
-- RLS) for actual authorization; this policy only gates the Supabase client's
-- direct Realtime/REST access.

GRANT SELECT ON "public"."messages" TO authenticated;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_messages" ON "public"."messages"
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON "public"."notifications" TO authenticated;
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_notifications" ON "public"."notifications"
  FOR SELECT TO authenticated USING (true);
