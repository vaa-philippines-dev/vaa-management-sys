'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { Hash, Send, Search, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChannelRealtimeProvider } from '@/components/layout/ChannelRealtimeProvider'
import { MentionAutocomplete } from './MentionAutocomplete'
import { InboxSettingsModal } from './InboxSettingsModal'
import { UserProfilePanel, type ProfilePanelUser } from './UserProfilePanel'
import {
  getChannelMessages,
  getChannelMembers,
  getUserProfile,
  markChannelRead,
  sendMessage,
} from '@/app/(dashboard)/inbox/actions'

type ChannelSummary = {
  channelId: string
  departmentId: string
  departmentName: string
  unreadCount: number
  unreadMentions: number
}

type CurrentUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  systemRole: string
  messageColor: 'RED' | 'BLUE' | 'YELLOW'
}

type Member = { id: string; firstName: string; lastName: string; avatarUrl: string | null }

type MessageWithSender = {
  id: string
  channelId: string
  body: string
  createdAt: string | Date
  pending?: boolean
  sender: { id: string; firstName: string; lastName: string; messageColor: 'RED' | 'BLUE' | 'YELLOW' }
}

const BUBBLE_COLOR: Record<string, string> = {
  RED: 'bg-destructive/15 text-foreground border-destructive/25',
  BLUE: 'bg-blue-500/15 text-foreground border-blue-500/25 dark:bg-blue-400/15 dark:border-blue-400/25',
  YELLOW: 'bg-amber-400/20 text-foreground border-amber-400/30',
}

function renderBody(body: string, currentUserId: string) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const pattern = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g
  let key = 0

  while ((match = pattern.exec(body))) {
    if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index))
    const isMe = match[2] === currentUserId
    parts.push(
      <span
        key={key++}
        className={cn(
          'rounded px-1 py-0.5 font-medium',
          isMe ? 'bg-primary/20 text-primary' : 'bg-foreground/10 text-foreground'
        )}
      >
        @{match[1]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex))
  return parts
}

export function InboxView({
  channels: initialChannels,
  currentUser,
}: {
  channels: ChannelSummary[]
  currentUser: CurrentUser
}) {
  const searchParams = useSearchParams()
  const requestedChannelId = searchParams.get('channel')
  const [channels, setChannels] = useState(initialChannels)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    (requestedChannelId && initialChannels.some((c) => c.channelId === requestedChannelId)
      ? requestedChannelId
      : initialChannels[0]?.channelId) ?? null
  )
  const [lastHandledRequest, setLastHandledRequest] = useState<string | null>(requestedChannelId)

  useEffect(() => {
    if (activeChannelId) markChannelRead(activeChannelId)
  }, [activeChannelId])

  if (
    requestedChannelId &&
    requestedChannelId !== lastHandledRequest &&
    channels.some((c) => c.channelId === requestedChannelId)
  ) {
    setLastHandledRequest(requestedChannelId)
    setActiveChannelId(requestedChannelId)
    setChannels((prev) =>
      prev.map((c) => (c.channelId === requestedChannelId ? { ...c, unreadCount: 0, unreadMentions: 0 } : c))
    )
  }
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [messageColor, setMessageColorState] = useState(currentUser.messageColor)
  const [profileUser, setProfileUser] = useState<ProfilePanelUser | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    const onClickAway = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [dropdownOpen])

  const activeChannel = channels.find((c) => c.channelId === activeChannelId)

  const clearUnread = (channelId: string) => {
    setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, unreadCount: 0, unreadMentions: 0 } : c)))
    markChannelRead(channelId)
  }

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId)
    setDropdownOpen(false)
    clearUnread(channelId)
  }

  const openProfile = async (userId: string) => {
    const profile = await getUserProfile(userId)
    if (profile) setProfileUser(profile)
  }

  if (channels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You are not a member of any department yet.
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden border bg-card">
      <div className="flex w-60 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-xs font-semibold text-muted-foreground">Inbox</p>
          <div className="flex items-center gap-0.5">
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                aria-label="Jump to channel"
                aria-expanded={dropdownOpen}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-8 z-40 w-56 overflow-hidden rounded-lg border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 origin-top-right">
                  <div className="max-h-72 overflow-y-auto p-1">
                    {channels.map((c) => (
                      <button
                        key={c.channelId}
                        type="button"
                        onClick={() => handleSelectChannel(c.channelId)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted/60"
                      >
                        <Hash className="h-3 w-3 shrink-0 opacity-60" />
                        <span className="truncate flex-1">{c.departmentName}</span>
                        {c.unreadCount > 0 && (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {c.unreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Inbox settings"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-px p-1.5">
            {channels.map((c) => (
              <button
                key={c.channelId}
                type="button"
                onClick={() => handleSelectChannel(c.channelId)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors',
                  activeChannelId === c.channelId
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
                )}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate flex-1">{c.departmentName}</span>
                {c.unreadMentions > 0 ? (
                  <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                    @{c.unreadMentions}
                  </span>
                ) : c.unreadCount > 0 ? (
                  <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />
                ) : null}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </div>

      <div className="flex flex-1 min-w-0">
        <div className="flex flex-1 flex-col min-w-0">
          {activeChannel && (
            <ChannelThread
              key={activeChannel.channelId}
              channelId={activeChannel.channelId}
              departmentName={activeChannel.departmentName}
              currentUser={currentUser}
              messageColor={messageColor}
              onOpenProfile={openProfile}
            />
          )}
        </div>

        {profileUser && <UserProfilePanel user={profileUser} onClose={() => setProfileUser(null)} />}
      </div>

      <InboxSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        color={messageColor}
        onChangeColor={setMessageColorState}
      />
    </div>
  )
}

function ChannelThread({
  channelId,
  departmentName,
  currentUser,
  messageColor,
  onOpenProfile,
}: {
  channelId: string
  departmentName: string
  currentUser: CurrentUser
  messageColor: 'RED' | 'BLUE' | 'YELLOW'
  onOpenProfile: (userId: string) => void
}) {
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [draft, setDraft] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingBroadcastRef = useRef<((userId: string, firstName: string) => void) | null>(null)
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastTypingSentRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    getChannelMessages(channelId).then((data) => {
      if (!cancelled) setMessages(data as unknown as MessageWithSender[])
    })
    getChannelMembers(channelId).then((data) => {
      if (!cancelled) setMembers(data)
    })
    return () => {
      cancelled = true
    }
  }, [channelId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    return members.filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
  }, [members, mentionQuery])

  const handleRealtimeMessage = (row: { id: string; channel_id: string; sender_id: string; body: string; created_at: string }) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === row.id)) return prev

      let sender: MessageWithSender['sender']
      if (row.sender_id === currentUser.id) {
        sender = { id: currentUser.id, firstName: currentUser.firstName, lastName: currentUser.lastName, messageColor }
      } else {
        const knownSender = prev.find((m) => m.sender.id === row.sender_id)?.sender
        const member = members.find((m) => m.id === row.sender_id)
        sender = knownSender ?? (member
          ? { id: row.sender_id, firstName: member.firstName, lastName: member.lastName, messageColor: 'BLUE' as const }
          : { id: row.sender_id, firstName: 'Unknown', lastName: '', messageColor: 'BLUE' as const })
      }

      return [
        ...prev.filter((m) => !(m.pending && m.sender.id === row.sender_id && m.body === row.body)),
        { id: row.id, channelId: row.channel_id, body: row.body, createdAt: row.created_at, sender },
      ]
    })
    setTypingUsers((prev) => {
      if (!prev.has(row.sender_id)) return prev
      const next = new Map(prev)
      next.delete(row.sender_id)
      return next
    })
  }

  const handleTyping = ({ userId, firstName }: { userId: string; firstName: string }) => {
    if (userId === currentUser.id) return
    setTypingUsers((prev) => new Map(prev).set(userId, firstName))
    const timeouts = typingTimeoutsRef.current
    clearTimeout(timeouts.get(userId))
    timeouts.set(
      userId,
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev)
          next.delete(userId)
          return next
        })
      }, 3000)
    )
  }

  const insertMention = (member: Member) => {
    const atIndex = draft.lastIndexOf('@')
    const before = draft.slice(0, atIndex)
    const mention = `@[${member.firstName} ${member.lastName}](${member.id}) `
    setDraft(before + mention)
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  const handleDraftChange = (value: string) => {
    setDraft(value)

    const now = Date.now()
    if (now - lastTypingSentRef.current > 1500 && value.trim()) {
      lastTypingSentRef.current = now
      typingBroadcastRef.current?.(currentUser.id, currentUser.firstName)
    }

    const atIndex = value.lastIndexOf('@')
    if (atIndex === -1) {
      setMentionQuery(null)
      return
    }
    const afterAt = value.slice(atIndex + 1)
    if (/\s/.test(afterAt) || afterAt.includes(')')) {
      setMentionQuery(null)
      return
    }
    setMentionQuery(afterAt)
    setMentionActiveIndex(0)
  }

  const handleSend = () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setMentionQuery(null)

    const optimisticId = `pending-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        channelId,
        body,
        createdAt: new Date().toISOString(),
        pending: true,
        sender: { id: currentUser.id, firstName: currentUser.firstName, lastName: currentUser.lastName, messageColor },
      },
    ])

    startTransition(async () => {
      const message = await sendMessage(channelId, body)
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId)
        if (withoutOptimistic.some((m) => m.id === message.id)) return withoutOptimistic
        return [...withoutOptimistic, message as unknown as MessageWithSender]
      })
    })
  }

  const typingLabel = useMemo(() => {
    const names = [...typingUsers.values()]
    if (names.length === 0) return null
    if (names.length === 1) return `${names[0]} is typing...`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
    return `${names.length} people are typing...`
  }, [typingUsers])

  return (
    <>
      <ChannelRealtimeProvider
        channelId={channelId}
        onMessage={handleRealtimeMessage}
        onTyping={handleTyping}
        typingRef={typingBroadcastRef}
      />

      <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">{departmentName}</p>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No messages yet. Say hello.</p>
          ) : (
            messages.map((m) => {
              const isMe = m.sender.id === currentUser.id
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-end gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200',
                    isMe && 'flex-row-reverse'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenProfile(m.sender.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold transition-transform hover:scale-105"
                  >
                    {m.sender.firstName?.[0]}
                    {m.sender.lastName?.[0]}
                  </button>
                  <div className={cn('flex max-w-[70%] flex-col gap-0.5', isMe && 'items-end')}>
                    <div className={cn('flex items-baseline gap-2', isMe && 'flex-row-reverse')}>
                      <button
                        type="button"
                        onClick={() => onOpenProfile(m.sender.id)}
                        className="text-[12px] font-semibold hover:underline"
                      >
                        {isMe ? 'You' : `${m.sender.firstName} ${m.sender.lastName}`}
                      </button>
                      <p className="text-[10.5px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-2xl border px-3 py-1.5 text-[13px] whitespace-pre-wrap break-words',
                        BUBBLE_COLOR[m.sender.messageColor] ?? BUBBLE_COLOR.BLUE,
                        m.pending && 'opacity-60'
                      )}
                    >
                      {renderBody(m.body, currentUser.id)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="h-5 px-4 text-[11px] text-muted-foreground italic">{typingLabel}</div>

      <div className="relative flex items-center gap-2 border-t p-2.5">
        {mentionQuery !== null && (
          <MentionAutocomplete members={mentionMatches} activeIndex={mentionActiveIndex} onPick={insertMention} />
        )}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (mentionQuery !== null && mentionMatches.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setMentionActiveIndex((i) => (i + 1) % mentionMatches.length)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setMentionActiveIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length)
                return
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                insertMention(mentionMatches[mentionActiveIndex])
                return
              }
              if (e.key === 'Escape') {
                setMentionQuery(null)
                return
              }
            }

            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={`Message #${departmentName}... (type @ to mention)`}
          disabled={isPending}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button type="button" size="sm" onClick={handleSend} disabled={!draft.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </>
  )
}
