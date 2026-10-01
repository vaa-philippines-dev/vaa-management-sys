'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Briefcase, Clock, MessageSquare, Reply, MoreHorizontal, Circle, CircleDot, UserMinus, CalendarCheck, CalendarX } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  getMyNotifications,
  markAllNotificationsRead,
  markAllNotificationsUnread,
  markNotificationRead,
  markNotificationUnread,
} from '@/app/(dashboard)/notifications/actions'

type Notification = {
  id: string
  type:
    | 'NEW_ASSIGNMENT'
    | 'HOURS_SHORTFALL'
    | 'NEW_MESSAGE'
    | 'MESSAGE_REPLY'
    | 'RESIGNATION_INTAKE'
    | 'LEAVE_APPROVAL_NEEDED'
    | 'LEAVE_REQUEST_DECIDED'
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
  RESIGNATION_INTAKE: UserMinus,
  LEAVE_APPROVAL_NEEDED: CalendarCheck,
  LEAVE_REQUEST_DECIDED: CalendarX,
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Notifications are fetched on mount and again whenever the panel is opened.
  // This used to hold an open Supabase Realtime subscription on `notifications`
  // per signed-in tab, which meant a concurrent Realtime connection for every
  // session all day for a feed users glance at a few times. Refetching on open
  // costs one query per click instead, and is what the badge and list actually
  // need — see also lib/supabase/client.ts, which no longer wires Realtime at all.
  const refresh = useCallback(() => {
    getMyNotifications().then((data) => setNotifications(data))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

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

  const handleMarkAllUnread = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: false })))
    await markAllNotificationsUnread()
  }, [])

  const handleToggleRead = useCallback(async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextRead = !n.read
    setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: nextRead } : item)))
    if (nextRead) await markNotificationRead(n.id)
    else await markNotificationUnread(n.id)
  }, [])

  const handleItemClick = useCallback(
    async (n: Notification) => {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
      setOpen(false)
      await markNotificationRead(n.id)
      if ((n.type === 'NEW_MESSAGE' || n.type === 'MESSAGE_REPLY') && n.entityType === 'Channel' && n.entityId) {
        router.push(`/inbox?channel=${n.entityId}`)
      } else if (n.type === 'RESIGNATION_INTAKE' && n.entityId) {
        router.push(`/offboarding/${n.entityId}`)
      } else if (n.type === 'LEAVE_APPROVAL_NEEDED') {
        router.push('/leave/approvals')
      } else if (n.type === 'LEAVE_REQUEST_DECIDED') {
        router.push('/leave')
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
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Notification options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleMarkAllRead}>Mark all as read</DropdownMenuItem>
                <DropdownMenuItem onClick={handleMarkAllUnread}>Mark all as unread</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                      'group flex w-full items-start gap-2.5 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                      !n.read && 'bg-primary/5'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleToggleRead(n, e)}
                      aria-label={n.read ? 'Mark as unread' : 'Mark as read'}
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {n.read ? <Circle className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" /> : <CircleDot className="h-2.5 w-2.5 text-primary" />}
                    </span>
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
