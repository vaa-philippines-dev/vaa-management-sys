'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Hash,
  Megaphone,
  ArrowUp,
  Search,
  Settings,
  Pin,
  CornerUpLeft,
  Forward,
  MoreHorizontal,
  X,
  Plus,
  Camera,
  Bell,
  BellOff,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ChannelRealtimeProvider } from '@/components/layout/ChannelRealtimeProvider'
import { MentionAutocomplete } from './MentionAutocomplete'
import { InboxSettingsModal, type MessageColorValue } from './InboxSettingsModal'
import { UserProfilePanel, type ProfilePanelUser } from './UserProfilePanel'
import { ForwardMessageModal } from './ForwardMessageModal'
import { PinnedMessagesPanel } from './PinnedMessagesPanel'
import { GroupInfoPanel } from './GroupInfoPanel'
import { DMUserPickerModal, type PickerUser } from './DMUserPickerModal'
import { MessageListSkeleton } from './InboxSkeleton'
import { formatRelativeTime } from '@/lib/format-relative-time'
import {
  getChannelMessages,
  getChannelMembers,
  getUserProfile,
  markChannelRead,
  sendMessage,
  editMessage,
  deleteMessage,
  replyToMessage,
  bumpMessage,
  pinMessage,
  pinDirectMessage,
  muteChannel,
  archiveDirectMessage,
  clearDirectMessage,
} from '@/app/(dashboard)/inbox/actions'

type DepartmentChannelSummary = {
  kind: 'DEPARTMENT' | 'ANNOUNCEMENTS'
  channelId: string
  departmentId: string | null
  departmentName: string
  unreadCount: number
  unreadMentions: number
  pinnedCount: number
}

type DirectChannelSummary = {
  kind: 'DIRECT'
  channelId: string
  otherUser: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null
  muted: boolean
  archived: boolean
  unreadCount: number
  unreadMentions: number
  pinnedCount: number
  lastMessage: { body: string; createdAt: string | Date; senderId: string } | null
}

type ChannelSummary = DepartmentChannelSummary | DirectChannelSummary

type CurrentUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  systemRole: string
  messageColor: MessageColorValue
}

type Member = { id: string; firstName: string; lastName: string; avatarUrl: string | null }

type ReplyPreview = { id: string; body: string; deletedAt: string | Date | null; senderName: string } | null

type MessageWithSender = {
  id: string
  channelId: string
  body: string
  createdAt: string | Date
  pending?: boolean
  editedAt?: string | Date | null
  deletedAt?: string | Date | null
  parentId?: string | null
  pinned?: boolean
  forwardedFromBody?: string | null
  forwardedFromSenderName?: string | null
  parent?: {
    id: string
    body: string
    deletedAt: string | Date | null
    sender: { firstName: string; lastName: string }
  } | null
  sender: {
    id: string
    firstName: string
    lastName: string
    messageColor: MessageColorValue
    avatarUrl?: string | null
  }
}

const BUBBLE_COLOR: Record<MessageColorValue, string> = {
  BLUE: 'bg-[#0B84FE] text-white dark:bg-[#0A6CD4]',
  RED: 'bg-[#FF3B30] text-white dark:bg-[#D4302A]',
  GREEN: 'bg-[#33C759] text-white dark:bg-[#28A745]',
  YELLOW: 'bg-[#FFCC00] text-black dark:bg-[#E0B400] dark:text-black',
  BLACK: 'bg-[#1C1C1E] text-white dark:bg-[#3A3A3C]',
}

const NEUTRAL_RECEIVED_BUBBLE = 'bg-[#E9E9EB] text-[#1C1C1E] dark:bg-[#2C2C2E] dark:text-[#F2F2F7]'

const MODERATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER']

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

function dayKey(date: string | Date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDateLabel(date: string | Date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (dayKey(d) === dayKey(today)) return 'Today'
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday'

  const sameYear = d.getFullYear() === today.getFullYear()
  return d.toLocaleDateString([], sameYear ? { month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' })
}

export function InboxView({
  channels: initialChannels,
  directMessages: initialDirectMessages,
  currentUser,
}: {
  channels: DepartmentChannelSummary[]
  directMessages: DirectChannelSummary[]
  currentUser: CurrentUser
}) {
  const searchParams = useSearchParams()
  const requestedChannelId = searchParams.get('channel')
  const [channels, setChannels] = useState(initialChannels)
  const [directMessages, setDirectMessages] = useState(initialDirectMessages)
  const allChannels = useMemo<ChannelSummary[]>(() => [...channels, ...directMessages], [channels, directMessages])

  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    (requestedChannelId && allChannels.some((c) => c.channelId === requestedChannelId)
      ? requestedChannelId
      : allChannels[0]?.channelId) ?? null
  )
  const [lastHandledRequest, setLastHandledRequest] = useState<string | null>(requestedChannelId)

  useEffect(() => {
    if (activeChannelId) markChannelRead(activeChannelId)
  }, [activeChannelId])

  if (
    requestedChannelId &&
    requestedChannelId !== lastHandledRequest &&
    allChannels.some((c) => c.channelId === requestedChannelId)
  ) {
    setLastHandledRequest(requestedChannelId)
    setActiveChannelId(requestedChannelId)
    setChannels((prev) => prev.map((c) => (c.channelId === requestedChannelId ? { ...c, unreadCount: 0, unreadMentions: 0 } : c)))
    setDirectMessages((prev) => prev.map((c) => (c.channelId === requestedChannelId ? { ...c, unreadCount: 0, unreadMentions: 0 } : c)))
  }

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [messageColor, setMessageColorState] = useState(currentUser.messageColor)
  const [profileUser, setProfileUser] = useState<ProfilePanelUser | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const [groupInfoOpen, setGroupInfoOpen] = useState(false)
  const [dmPickerOpen, setDmPickerOpen] = useState(false)
  const [dmSearch, setDmSearch] = useState('')
  const [showArchivedDMs, setShowArchivedDMs] = useState(false)
  const [clearGeneration, setClearGeneration] = useState<Record<string, number>>({})
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    const onClickAway = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [dropdownOpen])

  const activeChannel = allChannels.find((c) => c.channelId === activeChannelId)

  const clearUnread = (channelId: string) => {
    setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, unreadCount: 0, unreadMentions: 0 } : c)))
    setDirectMessages((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, unreadCount: 0, unreadMentions: 0 } : c)))
    markChannelRead(channelId)
  }

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId)
    setDropdownOpen(false)
    setPinnedOpen(false)
    setGroupInfoOpen(false)
    clearUnread(channelId)
  }

  const handleDMStarted = (channelId: string, otherUser: PickerUser) => {
    if (!directMessages.some((c) => c.channelId === channelId)) {
      setDirectMessages((prev) => [
        ...prev,
        {
          kind: 'DIRECT',
          channelId,
          otherUser,
          muted: false,
          archived: false,
          unreadCount: 0,
          unreadMentions: 0,
          pinnedCount: 0,
          lastMessage: null,
        },
      ])
    }
    handleSelectChannel(channelId)
  }

  const handleToggleMute = (dm: DirectChannelSummary) => {
    const nextMuted = !dm.muted
    setDirectMessages((prev) => prev.map((c) => (c.channelId === dm.channelId ? { ...c, muted: nextMuted } : c)))
    muteChannel(dm.channelId, nextMuted)
  }

  const handleToggleArchive = (dm: DirectChannelSummary) => {
    const nextArchived = !dm.archived
    setDirectMessages((prev) => prev.map((c) => (c.channelId === dm.channelId ? { ...c, archived: nextArchived } : c)))
    archiveDirectMessage(dm.channelId, nextArchived)
  }

  const handleClearConversation = (dm: DirectChannelSummary) => {
    if (!window.confirm('Clear this conversation? This only removes it from your view.')) return
    setDirectMessages((prev) =>
      prev.map((c) => (c.channelId === dm.channelId ? { ...c, lastMessage: null, unreadCount: 0, unreadMentions: 0 } : c))
    )
    clearDirectMessage(dm.channelId)
    setClearGeneration((prev) => ({ ...prev, [dm.channelId]: (prev[dm.channelId] ?? 0) + 1 }))
  }

  const openProfile = async (userId: string) => {
    const profile = await getUserProfile(userId)
    if (profile) setProfileUser(profile)
  }

  const updatePinnedCount = (channelId: string, delta: number) => {
    setChannels((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, pinnedCount: Math.max(0, c.pinnedCount + delta) } : c)))
    setDirectMessages((prev) => prev.map((c) => (c.channelId === channelId ? { ...c, pinnedCount: Math.max(0, c.pinnedCount + delta) } : c)))
  }

  const dmSearchLower = dmSearch.trim().toLowerCase()
  const matchesDmSearch = (dm: DirectChannelSummary) =>
    !dmSearchLower || (dm.otherUser ? `${dm.otherUser.firstName} ${dm.otherUser.lastName}`.toLowerCase().includes(dmSearchLower) : false)
  const filteredActiveDMs = directMessages.filter((dm) => !dm.archived && matchesDmSearch(dm))
  const filteredArchivedDMs = directMessages.filter((dm) => dm.archived && matchesDmSearch(dm))

  if (allChannels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No conversations yet.
      </div>
    )
  }

  const canModerate = MODERATOR_ROLES.includes(currentUser.systemRole)

  const forwardOptions = [
    ...channels.map((c) => ({ kind: c.kind, channelId: c.channelId, departmentName: c.departmentName }) as const),
    ...directMessages.map((c) => ({
      kind: 'DIRECT' as const,
      channelId: c.channelId,
      otherUserName: c.otherUser ? `${c.otherUser.firstName} ${c.otherUser.lastName}` : 'Direct Message',
      otherUserAvatarUrl: c.otherUser?.avatarUrl ?? null,
    })),
  ]

  return (
    <div className="flex h-full overflow-hidden border bg-card">
      <div className="flex w-64 shrink-0 flex-col border-r">
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
                    {allChannels.map((c) => (
                      <button
                        key={c.channelId}
                        type="button"
                        onClick={() => handleSelectChannel(c.channelId)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted/60"
                      >
                        {c.kind === 'DIRECT' ? (
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[8px] font-semibold">
                            {c.otherUser?.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.otherUser.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              c.otherUser?.firstName[0] ?? '?'
                            )}
                          </div>
                        ) : c.kind === 'ANNOUNCEMENTS' ? (
                          <Megaphone className="h-3 w-3 shrink-0 opacity-60" />
                        ) : (
                          <Hash className="h-3 w-3 shrink-0 opacity-60" />
                        )}
                        <span className="truncate flex-1">
                          {c.kind === 'DIRECT' ? (c.otherUser ? `${c.otherUser.firstName} ${c.otherUser.lastName}` : 'Direct Message') : c.departmentName}
                        </span>
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
          <div className="flex flex-col gap-3 p-1.5">
            <section>
              <p className="px-1.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Department Channels
              </p>
              <nav className="flex flex-col gap-px">
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
                    {c.kind === 'ANNOUNCEMENTS' ? (
                      <Megaphone className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    )}
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
            </section>

            <section>
              <div className="flex items-center justify-between px-1.5 py-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70">Direct Messages</p>
                <button
                  type="button"
                  onClick={() => setDmPickerOpen(true)}
                  aria-label="New direct message"
                  className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {directMessages.length > 4 && (
                <div className="px-1.5 pb-1">
                  <input
                    value={dmSearch}
                    onChange={(e) => setDmSearch(e.target.value)}
                    placeholder="Search people..."
                    className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-[11px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
              )}
              <nav className="flex flex-col gap-px">
                {filteredActiveDMs.map((dm) => (
                  <DMRow
                    key={dm.channelId}
                    dm={dm}
                    isActive={activeChannelId === dm.channelId}
                    onSelect={() => handleSelectChannel(dm.channelId)}
                    onToggleMute={() => handleToggleMute(dm)}
                    onToggleArchive={() => handleToggleArchive(dm)}
                    onClear={() => handleClearConversation(dm)}
                  />
                ))}
              </nav>
              {filteredArchivedDMs.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowArchivedDMs((v) => !v)}
                    className="mt-1 flex w-full items-center gap-1 px-1.5 py-1 text-[10.5px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className={cn('h-3 w-3 transition-transform', !showArchivedDMs && '-rotate-90')} />
                    Archived ({filteredArchivedDMs.length})
                  </button>
                  {showArchivedDMs && (
                    <nav className="flex flex-col gap-px">
                      {filteredArchivedDMs.map((dm) => (
                        <DMRow
                          key={dm.channelId}
                          dm={dm}
                          isActive={activeChannelId === dm.channelId}
                          onSelect={() => handleSelectChannel(dm.channelId)}
                          onToggleMute={() => handleToggleMute(dm)}
                          onToggleArchive={() => handleToggleArchive(dm)}
                          onClear={() => handleClearConversation(dm)}
                        />
                      ))}
                    </nav>
                  )}
                </>
              )}
            </section>
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-1 min-w-0">
        <div className="flex flex-1 flex-col min-w-0">
          {activeChannel && (
            <ChannelThread
              key={`${activeChannel.channelId}:${clearGeneration[activeChannel.channelId] ?? 0}`}
              channel={activeChannel}
              currentUser={currentUser}
              messageColor={messageColor}
              canModerate={canModerate}
              forwardOptions={forwardOptions}
              onOpenProfile={openProfile}
              onTogglePinnedPanel={() => {
                setPinnedOpen((v) => !v)
                setGroupInfoOpen(false)
              }}
              onToggleGroupInfo={() => {
                setGroupInfoOpen((v) => !v)
                setPinnedOpen(false)
              }}
              onPinnedCountChange={(delta) => updatePinnedCount(activeChannel.channelId, delta)}
            />
          )}
        </div>

        {pinnedOpen && activeChannel && (
          <PinnedMessagesPanel
            key={activeChannel.channelId}
            channelId={activeChannel.channelId}
            canUnpin={activeChannel.kind === 'DIRECT' ? true : canModerate}
            onClose={() => setPinnedOpen(false)}
            onJumpTo={(messageId) => {
              document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
          />
        )}

        {groupInfoOpen && activeChannel && activeChannel.kind === 'DEPARTMENT' && (
          <GroupInfoPanel
            key={activeChannel.channelId}
            channelId={activeChannel.channelId}
            onClose={() => setGroupInfoOpen(false)}
            onOpenPinned={() => {
              setGroupInfoOpen(false)
              setPinnedOpen(true)
            }}
          />
        )}

        {profileUser && !pinnedOpen && !groupInfoOpen && <UserProfilePanel user={profileUser} onClose={() => setProfileUser(null)} />}
      </div>

      <InboxSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        color={messageColor}
        onChangeColor={setMessageColorState}
      />

      <DMUserPickerModal open={dmPickerOpen} onOpenChange={setDmPickerOpen} onStarted={handleDMStarted} />
    </div>
  )
}

type ComposerMode = { type: 'reply' | 'edit'; message: MessageWithSender } | null

function ChannelThread({
  channel,
  currentUser,
  messageColor,
  canModerate,
  forwardOptions,
  onOpenProfile,
  onTogglePinnedPanel,
  onToggleGroupInfo,
  onPinnedCountChange,
}: {
  channel: ChannelSummary
  currentUser: CurrentUser
  messageColor: MessageColorValue
  canModerate: boolean
  forwardOptions: (
    | { kind: 'DEPARTMENT' | 'ANNOUNCEMENTS'; channelId: string; departmentName: string }
    | { kind: 'DIRECT'; channelId: string; otherUserName: string; otherUserAvatarUrl: string | null }
  )[]
  onOpenProfile: (userId: string) => void
  onTogglePinnedPanel: () => void
  onToggleGroupInfo: () => void
  onPinnedCountChange: (delta: number) => void
}) {
  const channelId = channel.channelId
  const isDM = channel.kind === 'DIRECT'
  const canPost = channel.kind !== 'ANNOUNCEMENTS' || MODERATOR_ROLES.includes(currentUser.systemRole)
  const canPinInThread = isDM || canModerate
  const headerTitle = channel.kind === 'DIRECT'
    ? channel.otherUser
      ? `${channel.otherUser.firstName} ${channel.otherUser.lastName}`
      : 'Direct Message'
    : channel.departmentName
  const composerLabel = channel.kind === 'DIRECT'
    ? channel.otherUser?.firstName ?? 'this person'
    : `#${channel.departmentName}`

  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [messagesLoaded, setMessagesLoaded] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [draft, setDraft] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const [composerMode, setComposerMode] = useState<ComposerMode>(null)
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)
  const typingBroadcastRef = useRef<((userId: string, firstName: string) => void) | null>(null)
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastTypingSentRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    getChannelMessages(channelId).then((result) => {
      if (cancelled) return
      setMessages(result.messages as unknown as MessageWithSender[])
      setHasMoreOlder(result.hasMore)
      setMessagesLoaded(true)
    })
    getChannelMembers(channelId).then((data) => {
      if (!cancelled) setMembers(data)
    })
    return () => {
      cancelled = true
    }
  }, [channelId])

  const loadOlderMessages = () => {
    const oldest = messages[0]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    const root = scrollAreaRef.current
    const prevScrollHeight = root?.scrollHeight ?? 0

    getChannelMessages(channelId, { createdAt: oldest.createdAt, id: oldest.id }).then((result) => {
      setMessages((prev) => [...(result.messages as unknown as MessageWithSender[]), ...prev])
      setHasMoreOlder(result.hasMore)
      setLoadingOlder(false)
      requestAnimationFrame(() => {
        if (root) root.scrollTop += root.scrollHeight - prevScrollHeight
      })
    })
  }

  useEffect(() => {
    if (!hasMoreOlder || loadingOlder) return
    const sentinel = topSentinelRef.current
    const root = scrollAreaRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadOlderMessages()
      },
      { root, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadOlderMessages closes over messages/channelId by design; re-created each render is fine, only these three should re-arm the observer
  }, [hasMoreOlder, loadingOlder, messages])

  useEffect(() => {
    const newLastId = messages[messages.length - 1]?.id ?? null
    if (newLastId !== lastMessageIdRef.current) {
      const wasNearBottom = lastMessageIdRef.current === null
      const root = scrollAreaRef.current
      const nearBottom = wasNearBottom || (root ? root.scrollHeight - root.scrollTop - root.clientHeight < 150 : true)
      lastMessageIdRef.current = newLastId
      if (nearBottom) {
        bottomRef.current?.scrollIntoView({ block: 'end' })
        setShowJumpToLatest(false)
      } else {
        setShowJumpToLatest(true)
      }
    }
  }, [messages])

  useEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return
    const handleScroll = () => {
      const nearBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 150
      if (nearBottom) setShowJumpToLatest(false)
    }
    root.addEventListener('scroll', handleScroll)
    return () => root.removeEventListener('scroll', handleScroll)
  }, [])

  const jumpToLatest = () => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    setShowJumpToLatest(false)
  }

  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = 'auto'
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 128)}px`
  }, [draft])

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    return members.filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
  }, [members, mentionQuery])

  const handleRealtimeMessage = (row: {
    id: string
    channel_id: string
    sender_id: string
    body: string
    created_at: string
    parent_id: string | null
    pinned: boolean
    forwarded_from_body: string | null
    forwarded_from_sender_name: string | null
  }) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === row.id)) return prev

      let sender: MessageWithSender['sender']
      if (row.sender_id === currentUser.id) {
        sender = {
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          messageColor,
          avatarUrl: currentUser.avatarUrl,
        }
      } else {
        const knownSender = prev.find((m) => m.sender.id === row.sender_id)?.sender
        const member = members.find((m) => m.id === row.sender_id)
        sender = knownSender ?? (member
          ? {
              id: row.sender_id,
              firstName: member.firstName,
              lastName: member.lastName,
              messageColor: 'BLUE' as const,
              avatarUrl: member.avatarUrl,
            }
          : { id: row.sender_id, firstName: 'Unknown', lastName: '', messageColor: 'BLUE' as const, avatarUrl: null })
      }

      const parent = row.parent_id ? prev.find((m) => m.id === row.parent_id) : undefined

      return [
        ...prev.filter((m) => !(m.pending && m.sender.id === row.sender_id && m.body === row.body)),
        {
          id: row.id,
          channelId: row.channel_id,
          body: row.body,
          createdAt: row.created_at,
          parentId: row.parent_id,
          pinned: row.pinned,
          forwardedFromBody: row.forwarded_from_body,
          forwardedFromSenderName: row.forwarded_from_sender_name,
          parent: parent
            ? { id: parent.id, body: parent.body, deletedAt: parent.deletedAt ?? null, sender: parent.sender }
            : undefined,
          sender,
        },
      ]
    })
    setTypingUsers((prev) => {
      if (!prev.has(row.sender_id)) return prev
      const next = new Map(prev)
      next.delete(row.sender_id)
      return next
    })
  }

  const handleRealtimeMessageUpdate = (row: {
    id: string
    body: string
    edited_at: string | null
    deleted_at: string | null
    pinned: boolean
  }) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === row.id
          ? { ...m, body: row.body, editedAt: row.edited_at, deletedAt: row.deleted_at, pinned: row.pinned }
          : m
      )
    )
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

  const startReply = (message: MessageWithSender) => {
    setComposerMode({ type: 'reply', message })
    inputRef.current?.focus()
  }

  const startEdit = (message: MessageWithSender) => {
    setComposerMode({ type: 'edit', message })
    setDraft(message.body)
    inputRef.current?.focus()
  }

  const cancelComposerMode = () => {
    setComposerMode(null)
    if (composerMode?.type === 'edit') setDraft('')
  }

  const handleBump = (message: MessageWithSender) => {
    startTransition(async () => {
      await bumpMessage(message.id)
      toast.success('Bumped')
    })
  }

  const handleDelete = (message: MessageWithSender) => {
    if (!window.confirm('Delete this message?')) return
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, deletedAt: new Date().toISOString() } : m)))
    startTransition(async () => {
      await deleteMessage(message.id)
    })
  }

  const handleTogglePin = (message: MessageWithSender) => {
    const nextPinned = !message.pinned
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, pinned: nextPinned } : m)))
    onPinnedCountChange(nextPinned ? 1 : -1)
    startTransition(async () => {
      if (isDM) await pinDirectMessage(message.id, nextPinned)
      else await pinMessage(message.id, nextPinned)
    })
  }

  const handleAttachmentPlaceholder = () => {
    toast('Attachments are coming soon')
  }

  const handleSend = () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setMentionQuery(null)
    const mode = composerMode
    setComposerMode(null)

    if (mode?.type === 'edit') {
      setMessages((prev) => prev.map((m) => (m.id === mode.message.id ? { ...m, body, editedAt: new Date().toISOString() } : m)))
      startTransition(async () => {
        await editMessage(mode.message.id, body)
      })
      return
    }

    const optimisticId = `pending-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        channelId,
        body,
        createdAt: new Date().toISOString(),
        pending: true,
        parentId: mode?.type === 'reply' ? mode.message.id : undefined,
        parent:
          mode?.type === 'reply'
            ? {
                id: mode.message.id,
                body: mode.message.body,
                deletedAt: mode.message.deletedAt ?? null,
                sender: { firstName: mode.message.sender.firstName, lastName: mode.message.sender.lastName },
              }
            : undefined,
        sender: {
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          messageColor,
          avatarUrl: currentUser.avatarUrl,
        },
      },
    ])

    startTransition(async () => {
      const message =
        mode?.type === 'reply' ? await replyToMessage(channelId, mode.message.id, body) : await sendMessage(channelId, body)
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId)
        if (withoutOptimistic.some((m) => m.id === message.id)) return withoutOptimistic
        return [...withoutOptimistic, message as unknown as MessageWithSender]
      })
    })
  }

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(messageId)
    setTimeout(() => setHighlightedId((cur) => (cur === messageId ? null : cur)), 1500)
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
        onMessageUpdate={handleRealtimeMessageUpdate}
        onTyping={handleTyping}
        typingRef={typingBroadcastRef}
      />

      <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
        {channel.kind === 'DIRECT' ? (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold">
            {channel.otherUser?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={channel.otherUser.avatarUrl} alt={headerTitle} className="h-full w-full object-cover" />
            ) : (
              channel.otherUser?.firstName[0] ?? '?'
            )}
          </div>
        ) : channel.kind === 'ANNOUNCEMENTS' ? (
          <Megaphone className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Hash className="h-4 w-4 text-muted-foreground" />
        )}
        <p className="text-sm font-semibold flex-1">{headerTitle}</p>
        {channel.kind === 'DEPARTMENT' && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Channel options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleGroupInfo}>Group info</DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePinnedPanel}>Pinned messages</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          type="button"
          onClick={onTogglePinnedPanel}
          aria-label="Pinned messages"
          className="relative flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pin className="h-3.5 w-3.5" />
          {channel.pinnedCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold text-primary-foreground">
              {channel.pinnedCount}
            </span>
          )}
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
      <ScrollArea ref={scrollAreaRef} className="h-full px-4 py-3">
        <div className="flex flex-col gap-3">
          <div ref={topSentinelRef} />
          {loadingOlder && (
            <p className="py-2 text-center text-[11px] text-muted-foreground">Loading older messages...</p>
          )}
          {!hasMoreOlder && messages.length > 0 && (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              {isDM ? `Beginning of your conversation with ${composerLabel}` : `Beginning of ${composerLabel}`}
            </p>
          )}
          {!messagesLoaded ? (
            <MessageListSkeleton />
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No messages yet. Say hello.</p>
          ) : (
            messages.map((m, i) => {
              const isMe = m.sender.id === currentUser.id
              const isDeleted = Boolean(m.deletedAt)
              const canEdit = isMe && !isDeleted
              const canDelete = (isMe || canModerate) && !isDeleted
              const canPin = canPinInThread && !isDeleted
              const replyPreview: ReplyPreview = m.parent
                ? {
                    id: m.parent.id,
                    body: m.parent.body,
                    deletedAt: m.parent.deletedAt,
                    senderName: `${m.parent.sender.firstName} ${m.parent.sender.lastName}`,
                  }
                : null
              const prevMessage = messages[i - 1]
              const nextMessage = messages[i + 1]
              const showDateSeparator = !prevMessage || dayKey(prevMessage.createdAt) !== dayKey(m.createdAt)
              const isGroupedWithPrev =
                !showDateSeparator &&
                !!prevMessage &&
                prevMessage.sender.id === m.sender.id &&
                !m.parent &&
                !m.forwardedFromSenderName &&
                new Date(m.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 5 * 60 * 1000
              const isGroupedWithNext =
                !!nextMessage &&
                dayKey(nextMessage.createdAt) === dayKey(m.createdAt) &&
                nextMessage.sender.id === m.sender.id &&
                !nextMessage.parent &&
                !nextMessage.forwardedFromSenderName &&
                new Date(nextMessage.createdAt).getTime() - new Date(m.createdAt).getTime() < 5 * 60 * 1000

              return (
                <div key={m.id} className="contents">
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-border" />
                      <p className="shrink-0 text-[10.5px] font-medium text-muted-foreground">
                        {formatDateLabel(m.createdAt)}
                      </p>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div
                    id={`message-${m.id}`}
                    className={cn(
                      'group/message flex items-end gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 rounded-lg transition-colors',
                      isMe && 'flex-row-reverse',
                      isGroupedWithPrev ? 'mt-0.5' : 'mt-2',
                      highlightedId === m.id && 'bg-primary/10'
                    )}
                  >
                    {isMe || isGroupedWithNext ? (
                      <div className="h-7 w-7 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenProfile(m.sender.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold transition-transform hover:scale-105"
                      >
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
                      </button>
                    )}
                    <div className={cn('flex max-w-[70%] flex-col gap-0.5', isMe && 'items-end')}>
                      {!isGroupedWithPrev && (
                        <div className={cn('flex items-baseline gap-2', isMe && 'flex-row-reverse')}>
                          {!isMe && (
                            <button
                              type="button"
                              onClick={() => onOpenProfile(m.sender.id)}
                              className="text-[12px] font-semibold hover:underline"
                            >
                              {m.sender.firstName} {m.sender.lastName}
                            </button>
                          )}
                          <p className="text-[10.5px] text-muted-foreground">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {m.editedAt && <span className="italic"> (edited)</span>}
                          </p>
                        </div>
                      )}
                      <div className={cn('flex items-baseline gap-2', isMe && 'flex-row-reverse')}>
                        {isGroupedWithPrev && (
                          <p className="text-[10.5px] text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {m.editedAt && <span className="italic"> (edited)</span>}
                          </p>
                        )}
                        {!isDeleted && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="opacity-0 transition-opacity group-hover/message:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Message actions"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isMe ? 'end' : 'start'}>
                              <DropdownMenuItem onClick={() => startReply(m)}>Reply</DropdownMenuItem>
                              {canEdit && <DropdownMenuItem onClick={() => startEdit(m)}>Edit</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => setForwardMessageId(m.id)}>Forward</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleBump(m)}>Bump</DropdownMenuItem>
                              {canPin && (
                                <DropdownMenuItem onClick={() => handleTogglePin(m)}>
                                  {m.pinned ? 'Unpin' : 'Pin'}
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => handleDelete(m)}>
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {replyPreview && (
                        <button
                          type="button"
                          onClick={() => scrollToMessage(replyPreview.id)}
                          className={cn(
                            'flex max-w-full items-center gap-1 truncate rounded-md border-l-2 border-muted-foreground/30 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60',
                            isMe && 'flex-row-reverse'
                          )}
                        >
                          <CornerUpLeft className="h-3 w-3 shrink-0" />
                          <span className="shrink-0 font-medium">{replyPreview.senderName}:</span>
                          <span className="truncate">
                            {replyPreview.deletedAt ? 'Message deleted' : replyPreview.body}
                          </span>
                        </button>
                      )}

                      {m.forwardedFromSenderName && (
                        <div
                          className={cn(
                            'flex max-w-full items-center gap-1 truncate rounded-md border-l-2 border-muted-foreground/30 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground',
                            isMe && 'flex-row-reverse'
                          )}
                        >
                          <Forward className="h-3 w-3 shrink-0" />
                          <span>Forwarded from {m.forwardedFromSenderName}</span>
                        </div>
                      )}

                      <div
                        className={cn(
                          'rounded-2xl px-3.5 py-2 text-[13px] whitespace-pre-wrap break-words shadow-sm',
                          isMe ? BUBBLE_COLOR[m.sender.messageColor] ?? BUBBLE_COLOR.BLUE : NEUTRAL_RECEIVED_BUBBLE,
                          m.pending && 'opacity-60',
                          isDeleted && 'italic text-muted-foreground shadow-none bg-transparent'
                        )}
                      >
                        {isDeleted ? 'Message deleted' : renderBody(m.body, currentUser.id)}
                      </div>
                      {isMe && !isDeleted && (
                        <p
                          className={cn(
                            'text-[10px] text-muted-foreground/70',
                            m.pending ? '' : 'opacity-0 transition-opacity group-hover/message:opacity-100'
                          )}
                        >
                          {m.pending ? 'Sending…' : 'Sent'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      {showJumpToLatest && (
        <button
          type="button"
          onClick={jumpToLatest}
          aria-label="Jump to latest messages"
          className="absolute bottom-3 right-4 flex h-8 w-8 items-center justify-center rounded-full border bg-popover text-muted-foreground shadow-lg transition-transform hover:scale-105 hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
      </div>

      <div className="h-5 px-4 text-[11px] text-muted-foreground italic">{typingLabel}</div>

      {composerMode && (
        <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-1.5 text-[11px]">
          <span className="truncate">
            {composerMode.type === 'edit' ? 'Editing message' : `Replying to ${composerMode.message.sender.firstName}`}
          </span>
          <button
            type="button"
            onClick={cancelComposerMode}
            aria-label="Cancel"
            className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {!canPost ? (
        <div className="border-t px-4 py-3 text-center text-[12px] text-muted-foreground">
          Only admins and managers can post in #{channel.departmentName}.
        </div>
      ) : (
        <div className="relative flex items-end gap-1.5 border-t p-2.5">
          {mentionQuery !== null && (
            <MentionAutocomplete members={mentionMatches} activeIndex={mentionActiveIndex} onPick={insertMention} />
          )}
          <button
            type="button"
            onClick={handleAttachmentPlaceholder}
            aria-label="Add photo"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleAttachmentPlaceholder}
            aria-label="Add attachment"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
          <textarea
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
            rows={1}
            placeholder={`Message ${composerLabel}... (type @ to mention)`}
            disabled={isPending}
            className="max-h-32 w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B84FE] text-white shadow-sm transition-all hover:bg-[#0A6CD4] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.75} />
          </button>
        </div>
      )}

      <ForwardMessageModal
        open={forwardMessageId !== null}
        onOpenChange={(open) => !open && setForwardMessageId(null)}
        messageId={forwardMessageId}
        currentChannelId={channelId}
        channels={forwardOptions}
      />
    </>
  )
}

function DMRow({
  dm,
  isActive,
  onSelect,
  onToggleMute,
  onToggleArchive,
  onClear,
}: {
  dm: DirectChannelSummary
  isActive: boolean
  onSelect: () => void
  onToggleMute: () => void
  onToggleArchive: () => void
  onClear: () => void
}) {
  const name = dm.otherUser ? `${dm.otherUser.firstName} ${dm.otherUser.lastName}` : 'Direct Message'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group/dmrow flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold">
        {dm.otherUser?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dm.otherUser.avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          dm.otherUser?.firstName[0] ?? '?'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[13px] font-medium">{name}</span>
          {dm.lastMessage && (
            <span className="shrink-0 text-[10px] text-muted-foreground/70">{formatRelativeTime(dm.lastMessage.createdAt)}</span>
          )}
        </div>
        {dm.lastMessage && <p className="truncate text-[11px] text-muted-foreground">{dm.lastMessage.body}</p>}
      </div>
      {!dm.muted && dm.unreadMentions > 0 ? (
        <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
          @{dm.unreadMentions}
        </span>
      ) : !dm.muted && dm.unreadCount > 0 ? (
        <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />
      ) : null}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          onToggleMute()
        }}
        aria-label={dm.muted ? 'Unmute' : 'Mute'}
        className="opacity-0 shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground group-hover/dmrow:opacity-100"
      >
        {dm.muted ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          aria-label="Conversation options"
          className="opacity-0 shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground group-hover/dmrow:opacity-100"
        >
          <MoreHorizontal className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onToggleArchive}>
            {dm.archived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" /> Archive
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onClear}>
            <Trash2 className="h-3.5 w-3.5" /> Clear conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </button>
  )
}
