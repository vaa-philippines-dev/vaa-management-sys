'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Hash, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChannelRealtimeProvider } from '@/components/layout/ChannelRealtimeProvider'
import { getChannelMessages, sendMessage } from '@/app/(dashboard)/messages/actions'

type ChannelSummary = {
  channelId: string
  departmentId: string
  departmentName: string
}

type CurrentUser = {
  id: string
  firstName: string
  lastName: string
}

type MessageWithSender = {
  id: string
  channelId: string
  body: string
  createdAt: string | Date
  sender: { id: string; firstName: string; lastName: string }
}

export function MessagesView({
  channels,
  currentUser,
}: {
  channels: ChannelSummary[]
  currentUser: CurrentUser
}) {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(channels[0]?.channelId ?? null)

  if (channels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You are not a member of any department yet.
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden rounded-lg border bg-card">
      <div className="w-56 shrink-0 border-r">
        <div className="border-b px-3 py-2.5">
          <p className="text-xs font-semibold text-muted-foreground">Channels</p>
        </div>
        <ScrollArea className="h-[calc(100%-2.5rem)]">
          <nav className="flex flex-col gap-px p-1.5">
            {channels.map((c) => (
              <button
                key={c.channelId}
                type="button"
                onClick={() => setActiveChannelId(c.channelId)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors',
                  activeChannelId === c.channelId
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
                )}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{c.departmentName}</span>
              </button>
            ))}
          </nav>
        </ScrollArea>
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        {activeChannelId && (
          <ChannelThread key={activeChannelId} channelId={activeChannelId} currentUser={currentUser} />
        )}
      </div>
    </div>
  )
}

function ChannelThread({ channelId, currentUser }: { channelId: string; currentUser: CurrentUser }) {
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getChannelMessages(channelId).then((data) => {
      if (!cancelled) setMessages(data as unknown as MessageWithSender[])
    })
    return () => {
      cancelled = true
    }
  }, [channelId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const handleRealtimeMessage = useCallback(
    (row: { id: string; channel_id: string; sender_id: string; body: string; created_at: string }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev
        const sender =
          row.sender_id === currentUser.id
            ? currentUser
            : prev.find((m) => m.sender.id === row.sender_id)?.sender ?? {
                id: row.sender_id,
                firstName: 'Unknown',
                lastName: '',
              }
        return [...prev, { id: row.id, channelId: row.channel_id, body: row.body, createdAt: row.created_at, sender }]
      })
    },
    [currentUser]
  )

  const handleSend = () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    startTransition(async () => {
      const message = await sendMessage(channelId, body)
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message as unknown as MessageWithSender]))
    })
  }

  return (
    <>
      <ChannelRealtimeProvider channelId={channelId} onMessage={handleRealtimeMessage} />

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No messages yet. Say hello.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                  {m.sender.firstName?.[0]}
                  {m.sender.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[13px] font-semibold">
                      {m.sender.firstName} {m.sender.lastName}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-[13px] whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t p-2.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Message this department..."
          disabled={isPending}
        />
        <Button type="button" size="sm" onClick={handleSend} disabled={isPending || !draft.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </>
  )
}
