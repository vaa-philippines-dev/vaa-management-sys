import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  }

  const supabase = createBrowserClient(url, key)

  // createBrowserClient doesn't wire the session token into the Realtime
  // websocket by itself — without this, every Realtime connection (and any
  // RLS policy scoped to `authenticated`) sees the client as `anon`, even
  // when the user is logged in.
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) supabase.realtime.setAuth(session.access_token)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    supabase.realtime.setAuth(session?.access_token ?? key)
  })

  return supabase
}
