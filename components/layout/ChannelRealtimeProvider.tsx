'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type MessageRow = {
  id: string
  channel_id: string
  sender_id: string
  body: string
  created_at: string
}

export function ChannelRealtimeProvider({
  channelId,
  onMessage,
}: {
  channelId: string
  onMessage: (message: MessageRow) => void
}) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`messages-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          onMessage(payload.new as MessageRow)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, onMessage])

  return null
}
