'use client'

import { useEffect, useState } from 'react'
import { Pin, PinOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPinnedMessages, pinMessage } from '@/app/(dashboard)/inbox/actions'

type PinnedMessage = {
  id: string
  body: string
  createdAt: string | Date
  pinnedAt: string | Date | null
  sender: { firstName: string; lastName: string; avatarUrl?: string | null }
  pinnedByUser: { firstName: string; lastName: string } | null
}

export function PinnedMessagesPanel({
  channelId,
  canUnpin,
  onClose,
  onJumpTo,
}: {
  channelId: string
  canUnpin: boolean
  onClose: () => void
  onJumpTo: (messageId: string) => void
}) {
  const [messages, setMessages] = useState<PinnedMessage[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getPinnedMessages(channelId).then((data) => {
      if (!cancelled) setMessages(data as unknown as PinnedMessage[])
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- component is remounted (keyed) by parent on channel change
  }, [])

  const handleUnpin = async (messageId: string) => {
    setMessages((prev) => (prev ? prev.filter((m) => m.id !== messageId) : prev))
    await pinMessage(messageId, false)
  }

  return (
    <div
      className={cn(
        'flex h-full w-72 shrink-0 flex-col border-l bg-card',
        'animate-in slide-in-from-right-8 fade-in-0 duration-200'
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">Pinned messages</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pinned messages"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {messages === null ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No pinned messages yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m.id} className="rounded-lg border bg-muted/30 p-2.5">
                <button type="button" onClick={() => onJumpTo(m.id)} className="block w-full text-left">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[8px] font-semibold">
                      {m.sender.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.sender.avatarUrl}
                          alt={`${m.sender.firstName} ${m.sender.lastName}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <>
                          {m.sender.firstName?.[0]}
                          {m.sender.lastName?.[0]}
                        </>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold">
                      {m.sender.firstName} {m.sender.lastName}
                    </p>
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-[12px] text-muted-foreground">{m.body}</p>
                </button>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Pin className="h-2.5 w-2.5" />
                    {m.pinnedByUser ? `${m.pinnedByUser.firstName} ${m.pinnedByUser.lastName}` : 'Unknown'}
                  </span>
                  {canUnpin && (
                    <button
                      type="button"
                      onClick={() => handleUnpin(m.id)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                    >
                      <PinOff className="h-2.5 w-2.5" />
                      Unpin
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
