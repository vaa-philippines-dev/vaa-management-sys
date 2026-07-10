-- Phase N: Grant USAGE on the public schema to authenticated.
--
-- Root cause of Realtime's "invalid column for filter" error: GRANT SELECT
-- on a table has no effect if the role can't even reach the schema it lives
-- in. Postgres requires USAGE on the schema as a prerequisite for any
-- table-level grant to be usable. Supabase Realtime validates postgres_changes
-- filters by running a check as the connecting role (authenticated here),
-- which was failing at the schema-access step before it ever got to evaluate
-- the column or RLS policy.

GRANT USAGE ON SCHEMA "public" TO authenticated;
