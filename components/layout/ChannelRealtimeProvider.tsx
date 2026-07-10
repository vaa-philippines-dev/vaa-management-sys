'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'

type MessageRow = {
  id: string
  channel_id: string
  sender_id: string
  body: string
  created_at: string
}

type TypingPayload = {
  userId: string
  firstName: string
}

export function ChannelRealtimeProvider({
  channelId,
  onMessage,
  onTyping,
  typingRef,
}: {
  channelId: string
  onMessage: (message: MessageRow) => void
  onTyping?: (payload: TypingPayload) => void
  typingRef?: React.MutableRefObject<((userId: string, firstName: string) => void) | null>
}) {
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`messages-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          // eslint-disable-next-line no-console -- temporary diagnostic for production realtime issue
          console.log(`[Inbox] received INSERT on messages-${channelId}:`, JSON.stringify(payload.new))
          onMessage(payload.new as MessageRow)
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        onTyping?.(payload as TypingPayload)
      })
      .subscribe((status, err) => {
        // eslint-disable-next-line no-console -- temporary diagnostic for production realtime issue
        console.log(`[Inbox] channel messages-${channelId} status:`, status, err ?? '')
      })

    broadcastChannelRef.current = channel

    if (typingRef) {
      typingRef.current = (userId: string, firstName: string) => {
        channel.send({ type: 'broadcast', event: 'typing', payload: { userId, firstName } })
      }
    }

    return () => {
      supabase.removeChannel(channel)
      if (typingRef) typingRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onMessage/onTyping are recreated each render by design; only channelId identity should re-subscribe
  }, [channelId])

  return null
}
