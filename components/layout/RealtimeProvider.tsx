'use client'

import { useEffect } from 'react'
import { createClient, waitForRealtimeAuth } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TaskChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

export function RealtimeProvider({
  children,
  onTaskChange,
}: {
  children: React.ReactNode
  onTaskChange?: (change: TaskChange) => void
}) {
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    waitForRealtimeAuth().then(() => {
      if (cancelled) return
      channel = supabase
        .channel('tasks-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            onTaskChange?.({
              eventType: payload.eventType as TaskChange['eventType'],
              new: payload.new as Record<string, unknown>,
              old: payload.old as Record<string, unknown>,
            })
          }
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [onTaskChange])

  return <>{children}</>
}
