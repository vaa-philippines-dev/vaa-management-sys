-- Phase O: Replace the `USING (true)` Realtime RLS policies from
-- phase_m_realtime_grants.sql with policies that actually scope rows to the
-- requesting user.
--
-- WHY: phase_m reasoned that "every read in this app already goes through
-- Prisma (connecting as postgres, bypassing RLS) for actual authorization; this
-- policy only gates the Supabase client's direct Realtime/REST access." The
-- second clause is the problem — that direct access is reachable by the user,
-- not just by our code. The browser holds both NEXT_PUBLIC_SUPABASE_ANON_KEY
-- (inlined into the client bundle) and its own `authenticated` JWT, so any
-- logged-in user can bypass the Next.js app entirely and query PostgREST:
--
--   curl 'https://<project>.supabase.co/rest/v1/messages?select=*' \
--     -H "apikey: <anon key>" -H "Authorization: Bearer <own access token>"
--
-- With `USING (true)` that returns EVERY row in `messages` — including private
-- DIRECT-channel conversations between other people — and every row in
-- `notifications`. Same via Realtime: the channel_id filter in
-- ChannelRealtimeProvider is a client-side subscription argument, so a user can
-- subscribe with any filter, or none, and stream all messages live. None of the
-- Channel/ChannelParticipant membership model or lib/auth.ts role checks apply
-- on this path.
--
-- The policies below mirror the app's own access model in getMyChannels()
-- (app/(dashboard)/inbox/actions.ts): ANNOUNCEMENTS is open to all authenticated
-- users, DEPARTMENT requires an active department membership, DIRECT requires an
-- explicit channel_participants row.
--
-- Identity join: Supabase Auth is identity-only here; the Prisma `users` table
-- is the authorization source of truth and is linked by email (see
-- getCurrentUser() in lib/auth.ts). `auth.jwt() ->> 'email'` is a top-level
-- verified claim — NOT user_metadata, which is user-editable and must never be
-- used for authorization. Each auth.jwt() call is wrapped in a scalar subquery
-- so Postgres evaluates it once per statement rather than once per row.

-- messages ------------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_read_messages" ON "public"."messages";

CREATE POLICY "read_accessible_channel_messages" ON "public"."messages"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."channels" c
      WHERE c.id = "messages".channel_id
        AND (
          -- ANNOUNCEMENTS: every authenticated user, matching getMyChannels()
          c.kind = 'ANNOUNCEMENTS'

          -- DEPARTMENT: active (not ended) membership in the channel's department
          OR EXISTS (
            SELECT 1
            FROM "public"."department_memberships" dm
            JOIN "public"."users" u ON u.id = dm.user_id
            WHERE dm.department_id = c.department_id
              AND dm.ended_at IS NULL
              AND u.email = (SELECT auth.jwt() ->> 'email')
          )

          -- DIRECT: explicit participant in the channel
          OR EXISTS (
            SELECT 1
            FROM "public"."channel_participants" cp
            JOIN "public"."users" u ON u.id = cp.user_id
            WHERE cp.channel_id = c.id
              AND u.email = (SELECT auth.jwt() ->> 'email')
          )
        )
    )
  );

-- notifications -------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_read_notifications" ON "public"."notifications";

CREATE POLICY "read_own_notifications" ON "public"."notifications"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."users" u
      WHERE u.id = "notifications".recipient_id
        AND u.email = (SELECT auth.jwt() ->> 'email')
    )
  );

-- Supporting indexes for the policy subqueries. The messages policy runs a
-- channel_participants lookup keyed by (channel_id, user_id) — already covered
-- by the @@unique([channelId, userId]) index — and a department_memberships
-- lookup keyed by (department_id, user_id), which the existing
-- @@index([userId, departmentId]) does not serve in that column order.
CREATE INDEX IF NOT EXISTS "department_memberships_department_id_user_id_idx"
  ON "public"."department_memberships" (department_id, user_id);

-- users.email already has a unique constraint (schema.prisma @unique), so the
-- email join is an index lookup.
