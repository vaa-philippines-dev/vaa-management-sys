'use client'

import { useEffect, useRef } from 'react'
import { createClient, waitForRealtimeAuth } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js'

type MessageRow = {
  id: string
  channel_id: string
  sender_id: string
  body: string
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  parent_id: string | null
  pinned: boolean
  pinned_at: string | null
  pinned_by: string | null
  forwarded_from_id: string | null
  forwarded_from_body: string | null
  forwarded_from_sender_name: string | null
}

type TypingPayload = {
  userId: string
  firstName: string
}

// Supabase Realtime sends timestamp columns as raw Postgres text with no
// timezone marker (e.g. "2026-07-11 17:01:42.875"), unlike Prisma/PostgREST
// which always include the "Z" suffix. `new Date(...)` treats an unmarked
// string as local time instead of UTC, so without this normalization a
// message's time renders correctly for the sender (whose local time happens
// to line up) but wrong for anyone in a different timezone until they
// refresh and refetch the same row via Prisma. Append "Z" (after swapping
// the space for "T") whenever the string lacks an explicit zone.
function toUtcIso(value: string | null): string | null {
  if (!value) return value
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value
  return `${value.replace(' ', 'T')}Z`
}

function normalizeMessageRow(row: MessageRow): MessageRow {
  return {
    ...row,
    created_at: toUtcIso(row.created_at) as string,
    edited_at: toUtcIso(row.edited_at),
    deleted_at: toUtcIso(row.deleted_at),
    pinned_at: toUtcIso(row.pinned_at),
  }
}

export function ChannelRealtimeProvider({
  channelId,
  onMessage,
  onMessageUpdate,
  onTyping,
  typingRef,
}: {
  channelId: string
  onMessage: (message: MessageRow) => void
  onMessageUpdate?: (message: MessageRow) => void
  onTyping?: (payload: TypingPayload) => void
  typingRef?: React.MutableRefObject<((userId: string, firstName: string) => void) | null>
}) {
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    waitForRealtimeAuth().then(() => {
      if (cancelled) return

      const channel = supabase
        .channel(`messages-${channelId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
          (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            onMessage(normalizeMessageRow(payload.new as MessageRow))
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
          (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            onMessageUpdate?.(normalizeMessageRow(payload.new as MessageRow))
          }
        )
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          onTyping?.(payload as TypingPayload)
        })
        .subscribe()

      broadcastChannelRef.current = channel

      if (typingRef) {
        typingRef.current = (userId: string, firstName: string) => {
          channel.send({ type: 'broadcast', event: 'typing', payload: { userId, firstName } })
        }
      }
    })

    return () => {
      cancelled = true
      if (broadcastChannelRef.current) supabase.removeChannel(broadcastChannelRef.current)
      if (typingRef) typingRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onMessage/onTyping are recreated each render by design; only channelId identity should re-subscribe
  }, [channelId])

  return null
}
