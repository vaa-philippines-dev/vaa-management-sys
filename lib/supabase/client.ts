import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Module-level singleton. Every caller shares one client, one auth listener,
// and one Realtime websocket.
let client: SupabaseClient | undefined
let authReady: Promise<void> | undefined

export function createClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  }

  const supabase = createBrowserClient(url, key)

  // createBrowserClient doesn't wire the session token into the Realtime
  // websocket by itself — without this, every Realtime connection (and any
  // RLS policy scoped to `authenticated`) sees the client as `anon`, even
  // when the user is logged in. getSession()/setAuth() is async, so callers
  // that .channel().subscribe() immediately after createClient() can join
  // before the token is applied — waitForRealtimeAuth() below lets them wait
  // for it first instead of racing.
  authReady = supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) supabase.realtime.setAuth(session.access_token)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    supabase.realtime.setAuth(session?.access_token ?? key)
  })

  client = supabase
  return supabase
}

// Resolves once the initial session (if any) has been applied to the
// Realtime socket. Callers should await this before .subscribe()-ing to a
// channel whose postgres_changes rely on an `authenticated`-scoped RLS
// policy, otherwise the join can race ahead of the auth token being set.
export function waitForRealtimeAuth() {
  return authReady ?? Promise.resolve()
}
