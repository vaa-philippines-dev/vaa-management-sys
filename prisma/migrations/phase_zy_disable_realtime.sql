-- Phase ZY — turn Supabase Realtime off.
--
-- The app no longer subscribes to anything: the notification bell refetches on
-- open, the Inbox is parked under "On Going", and lib/supabase/client.ts is
-- auth-only. Leaving these tables in the publication would keep Postgres doing
-- logical-decoding work for a feature with no listeners, and keep the project
-- burning Realtime concurrent connections and messages against the plan quota.
--
-- Reversible: re-add a table with
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.<table>;
-- and restore the client-side subscription along with it. Realtime also needs
-- the table's replica identity and RLS policies to still be in place — this
-- migration leaves both untouched, so only the publication membership changes.

ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
