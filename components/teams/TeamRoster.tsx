'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Crown, Search, ShieldHalf, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isEndedVAStatus, ENDED_VA_STATUS_LABEL } from '@/lib/active-va'
import { AVAILABILITY_LABEL, AVAILABILITY_TONE, BUCKET_LABEL, rosterBucket, type RosterBucket } from '@/lib/team-roster-fields'

export type TeamMemberRow = {
  membershipId: string
  userId: string
  name: string
  availabilityStatus: string | null
  vaStatus: string | null
  vaProfileId: string | null
  position: string | null
  // This department's active engagements; null when the viewer may not see them.
  clients: { id: string; name: string; hours: number }[] | null
  agreedHours: number
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

export function TeamRoster({
  members,
  leaderId,
  tempLeader1Id,
  tempLeader2Id,
  linkProfiles,
  selected,
  onToggle,
  onToggleAll,
  footer,
}: {
  members: TeamMemberRow[]
  leaderId: string | null
  tempLeader1Id: string | null
  tempLeader2Id: string | null
  // Whether names link to the VA profile (staff viewers only).
  linkProfiles: boolean
  // Selection is on only when the viewer can manage the roster.
  selected?: Set<string>
  onToggle?: (userId: string) => void
  onToggleAll?: (userIds: string[]) => void
  footer?: React.ReactNode
}) {
  const [search, setSearch] = useState('')
  const [bucket, setBucket] = useState<RosterBucket | 'ALL'>('ALL')

  const showClients = members.some((m) => m.clients !== null)
  const selectable = !!selected && !!onToggle

  const bucketCounts = useMemo(() => {
    const counts: Record<RosterBucket, number> = { AVAILABLE: 0, ASSIGNED: 0, ON_HOLD: 0, ENDED: 0 }
    for (const m of members) {
      const b = rosterBucket(m)
      if (b) counts[b] += 1
    }
    return counts
  }, [members])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const leaderRank = (id: string) => (id === leaderId ? 0 : id === tempLeader1Id || id === tempLeader2Id ? 1 : 2)
    return members
      .filter((m) => bucket === 'ALL' || rosterBucket(m) === bucket)
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          (m.position ?? '').toLowerCase().includes(q) ||
          (m.clients ?? []).some((c) => c.name.toLowerCase().includes(q))
      )
      // Leaders first, then the roster's own order.
      .sort((a, b) => leaderRank(a.userId) - leaderRank(b.userId))
  }, [members, search, bucket, leaderId, tempLeader1Id, tempLeader2Id])

  const allVisibleSelected = selectable && visible.length > 0 && visible.every((m) => selected!.has(m.userId))

  const grid = cn(
    'md:grid md:items-center md:gap-4',
    showClients
      ? selectable
        ? 'md:grid-cols-[20px_minmax(220px,1.3fr)_minmax(0,2fr)_80px_150px]'
        : 'md:grid-cols-[minmax(220px,1.3fr)_minmax(0,2fr)_80px_150px]'
      : selectable
        ? 'md:grid-cols-[20px_minmax(220px,1fr)_150px]'
        : 'md:grid-cols-[minmax(220px,1fr)_150px]'
  )

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 mr-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Members ({members.length})</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <BucketChip label="All" count={members.length} active={bucket === 'ALL'} onClick={() => setBucket('ALL')} />
          {(Object.keys(BUCKET_LABEL) as RosterBucket[]).map((b) =>
            bucketCounts[b] > 0 ? (
              <BucketChip
                key={b}
                label={BUCKET_LABEL[b]}
                count={bucketCounts[b]}
                active={bucket === b}
                tone={b === 'ENDED' ? 'destructive' : undefined}
                onClick={() => setBucket((prev) => (prev === b ? 'ALL' : b))}
              />
            ) : null
          )}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={showClients ? 'Search member, position, client…' : 'Search member…'}
            className="h-8 pl-8 pr-7 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No members yet.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">No members match these filters.</div>
      ) : (
        <>
          <div className={cn('hidden border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80', grid)}>
            {selectable && (
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => onToggleAll?.(visible.map((m) => m.userId))}
                className="h-3.5 w-3.5 accent-primary"
                aria-label="Select all shown"
              />
            )}
            <span>Member</span>
            {showClients && <span>Clients</span>}
            {showClients && <span className="text-right">Hours</span>}
            <span>Availability</span>
          </div>
          <div className="divide-y">
            {visible.map((m) => {
              const isLeader = m.userId === leaderId
              const isTemp = m.userId === tempLeader1Id || m.userId === tempLeader2Id
              const isSelected = selectable && selected!.has(m.userId)
              return (
                <div
                  key={m.membershipId}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-muted/30',
                    grid,
                    isSelected && 'bg-accent/40 hover:bg-accent/50'
                  )}
                >
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle!(m.userId)}
                      className="h-3.5 w-3.5 shrink-0 accent-primary"
                      aria-label={`Select ${m.name}`}
                    />
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 md:flex-none">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        isLeader || isTemp ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                      )}
                    >
                      {initials(m.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {linkProfiles && m.vaProfileId ? (
                          <Link href={`/vas/${m.vaProfileId}`} className="text-sm font-medium truncate hover:text-primary hover:underline">
                            {m.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium truncate">{m.name}</span>
                        )}
                        {(isLeader || isTemp) && (
                          <Badge variant="outline" className="text-[10px] gap-1 shrink-0 py-0">
                            {isLeader ? <Crown className="h-2.5 w-2.5" /> : <ShieldHalf className="h-2.5 w-2.5" />}
                            {isLeader ? 'Leader' : 'Temp Leader'}
                          </Badge>
                        )}
                      </div>
                      {m.position && <p className="text-xs text-muted-foreground truncate">{m.position}</p>}
                    </div>
                  </div>
                  {showClients && (
                    <div className="flex w-full flex-wrap gap-1 md:w-auto">
                      {!m.clients || m.clients.length === 0 ? (
                        <span className="text-xs text-muted-foreground/60">No client</span>
                      ) : (
                        m.clients.map((c, i) => (
                          <Badge key={`${c.id}:${i}`} variant="secondary" className="text-[10px] gap-1">
                            {c.name}
                            <span className="text-muted-foreground tabular-nums">{c.hours}h</span>
                          </Badge>
                        ))
                      )}
                    </div>
                  )}
                  {showClients && (
                    <span className="text-xs tabular-nums text-muted-foreground md:text-right">{m.agreedHours}h</span>
                  )}
                  {isEndedVAStatus(m.vaStatus) ? (
                    <StatusIndicator tone="destructive" className="shrink-0">
                      {ENDED_VA_STATUS_LABEL[m.vaStatus!] ?? m.vaStatus}
                    </StatusIndicator>
                  ) : (
                    <StatusIndicator tone={AVAILABILITY_TONE[m.availabilityStatus ?? ''] ?? 'neutral'} className="shrink-0">
                      {AVAILABILITY_LABEL[m.availabilityStatus ?? ''] ?? m.availabilityStatus ?? 'Unknown'}
                    </StatusIndicator>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {footer}
    </div>
  )
}

function BucketChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  tone?: 'destructive'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : tone === 'destructive'
            ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
            : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {label}
      <span className="text-[10px] tabular-nums opacity-80">{count}</span>
    </button>
  )
}
