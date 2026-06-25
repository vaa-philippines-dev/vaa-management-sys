'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    const supabase = createClient()

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onTaskChange])

  return <>{children}</>
}
