'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Briefcase, Clock, MessageSquare, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient, waitForRealtimeAuth } from '@/lib/supabase/client'
import { MentionToast } from './MentionToast'
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/app/(dashboard)/notifications/actions'

type Notification = {
  id: string
  type: 'NEW_ASSIGNMENT' | 'HOURS_SHORTFALL' | 'NEW_MESSAGE' | 'MESSAGE_REPLY'
  title: string
  message: string
  read: boolean
  createdAt: string | Date
  entityType?: string | null
  entityId?: string | null
  messageId?: string | null
  mentionerName?: string | null
  mentionerAvatarUrl?: string | null
  departmentName?: string | null
}

const TYPE_ICON: Record<Notification['type'], React.ComponentType<{ className?: string }>> = {
  NEW_ASSIGNMENT: Briefcase,
  HOURS_SHORTFALL: Clock,
  NEW_MESSAGE: MessageSquare,
  MESSAGE_REPLY: Reply,
}

export function NotificationBell({
  userId,
  currentUserMessageColor,
}: {
  userId: string
  currentUserMessageColor: 'RED' | 'BLUE' | 'YELLOW'
}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    getMyNotifications().then((data) => setNotifications(data))
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    waitForRealtimeAuth().then(() => {
      if (cancelled) return
      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as Notification
            setNotifications((prev) => [row, ...prev].slice(0, 20))

            const isChatNotification =
              (row.type === 'NEW_MESSAGE' || row.type === 'MESSAGE_REPLY') &&
              row.entityType === 'Channel' &&
              row.entityId

            if (isChatNotification && row.messageId) {
              toast.custom((t) => (
                <MentionToast
                  notification={row}
                  currentUserColor={currentUserMessageColor}
                  onNavigate={() => {
                    router.push(`/inbox?channel=${row.entityId}`)
                    toast.dismiss(t)
                  }}
                  onDismiss={() => toast.dismiss(t)}
                />
              ))
            } else {
              toast(row.title, {
                description: row.message,
                action: isChatNotification
                  ? { label: 'View', onClick: () => router.push(`/inbox?channel=${row.entityId}`) }
                  : undefined,
              })
            }
          }
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router from useRouter() is referentially stable, only userId should re-subscribe
  }, [userId])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await markAllNotificationsRead()
  }, [])

  const handleItemClick = useCallback(
    async (n: Notification) => {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
      setOpen(false)
      await markNotificationRead(n.id)
      if ((n.type === 'NEW_MESSAGE' || n.type === 'MESSAGE_REPLY') && n.entityType === 'Channel' && n.entityId) {
        router.push(`/inbox?channel=${n.entityId}`)
      }
    },
    [router]
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-destructive" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 origin-top-right">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications yet</p>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      'flex w-full items-start gap-2.5 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                      !n.read && 'bg-primary/5'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                    {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
