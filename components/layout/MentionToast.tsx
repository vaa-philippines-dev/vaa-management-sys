'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { replyFromNotification } from '@/app/(dashboard)/inbox/actions'

type MentionNotification = {
  id: string
  title: string
  message: string
  messageId?: string | null
  mentionerName?: string | null
  mentionerAvatarUrl?: string | null
  departmentName?: string | null
}

const NAME_COLOR: Record<'BLUE' | 'RED' | 'GREEN' | 'YELLOW' | 'BLACK', string> = {
  BLUE: 'text-[#0B84FE] dark:text-[#3B9EFF]',
  RED: 'text-[#FF3B30] dark:text-[#FF6961]',
  GREEN: 'text-[#33C759] dark:text-[#4CD964]',
  YELLOW: 'text-[#B38F00] dark:text-[#FFCC00]',
  BLACK: 'text-foreground',
}

export function MentionToast({
  notification,
  currentUserColor,
  onNavigate,
  onDismiss,
}: {
  notification: MentionNotification
  currentUserColor: 'BLUE' | 'RED' | 'GREEN' | 'YELLOW' | 'BLACK'
  onNavigate: () => void
  onDismiss: () => void
}) {
  const [reply, setReply] = useState('')
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSendReply = () => {
    const trimmed = reply.trim()
    if (!trimmed || isPending) return
    startTransition(async () => {
      await replyFromNotification(notification.id, trimmed)
      setSent(true)
      setTimeout(onDismiss, 900)
    })
  }

  return (
    <div className="w-80 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
      <button type="button" onClick={onNavigate} className="flex w-full items-start gap-2 text-left">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold">
          {notification.mentionerAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={notification.mentionerAvatarUrl} alt={notification.mentionerName ?? ''} className="h-full w-full object-cover" />
          ) : (
            notification.mentionerName?.[0]
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {notification.mentionerName && (
              <span className={NAME_COLOR[currentUserColor]}>{notification.mentionerName}</span>
            )}
            {notification.mentionerName ? ' ' : ''}
            {notification.departmentName ? (
              <span className="text-foreground">mentioned you in #{notification.departmentName}</span>
            ) : (
              <span className="text-foreground">{notification.title}</span>
            )}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{notification.message}</p>
        </div>
      </button>

      {notification.messageId && !sent && (
        <div className="mt-2 flex items-center gap-1.5">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendReply()
              }
            }}
            placeholder="Reply..."
            rows={1}
            className="flex-1 resize-none rounded-md border bg-background px-2 py-1 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!reply.trim() || isPending}
            onClick={handleSendReply}
            aria-label="Send reply"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {sent && <p className="mt-2 text-[11px] text-muted-foreground">Reply sent</p>}
    </div>
  )
}
