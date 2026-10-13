'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Crown, ShieldHalf, ChevronDown, AlertTriangle, UsersRound, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TeamAssignmentSummary, TeamMemberAssignmentRow } from '@/lib/team-assignments'
import type { PersonRef } from '@/lib/structure'
import { STATE_LABEL, STATE_TONE } from '@/lib/team-assignments-fields'

// One column template for the header and every row, so they line up.
const ROW_GRID = 'md:grid md:grid-cols-[minmax(200px,1.2fr)_minmax(0,2.4fr)_150px_110px] md:items-center md:gap-4'
const ROW_GRID_WITH_ACTION = 'md:grid md:grid-cols-[minmax(200px,1.2fr)_minmax(0,2.4fr)_150px_110px_auto] md:items-center md:gap-4'

function leaderName(person: PersonRef) {
  return `${person.firstName} ${person.lastName}`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

function LeaderChip({ person, icon: Icon, label }: { person: PersonRef | null; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
        person ? 'bg-card' : 'text-muted-foreground/60 border-dashed'
      )}
      title={label}
    >
      <Icon className={cn('h-3 w-3', person ? 'text-primary' : '')} />
      {person ? leaderName(person) : `${label}: vacant`}
    </span>
  )
}

function HoursCell({ member }: { member: TeamMemberAssignmentRow }) {
  const { totalAgreedHours: agreed, capacityHours: capacity } = member
  if (capacity == null || capacity <= 0) {
    return <span className="text-xs text-muted-foreground tabular-nums">{agreed}h</span>
  }
  const pct = Math.round((agreed / capacity) * 100)
  return (
    <div className="space-y-1" title={`${agreed} of ${capacity} capacity hours assigned (${pct}%)`}>
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="font-medium">{agreed}h</span>
        <span className="text-muted-foreground">/ {capacity}h</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', pct > 100 ? 'bg-destructive' : pct >= 90 ? 'bg-warning' : 'bg-success')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

export function MemberListHeader({ withAction = false }: { withAction?: boolean }) {
  return (
    <div
      className={cn(
        'hidden px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80 border-b bg-muted/10',
        withAction ? ROW_GRID_WITH_ACTION : ROW_GRID
      )}
    >
      <span>VA</span>
      <span>Clients (this department)</span>
      <span>Assigned / Capacity</span>
      <span>Status</span>
      {withAction && <span className="text-right">Team</span>}
    </div>
  )
}

export function MemberRow({ member, action }: { member: TeamMemberAssignmentRow; action?: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors hover:bg-muted/30',
        action ? ROW_GRID_WITH_ACTION : ROW_GRID
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 md:flex-none">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {initials(member.name)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {member.vaProfileId ? (
              <Link href={`/vas/${member.vaProfileId}`} className="text-sm font-medium truncate hover:text-primary hover:underline">
                {member.name}
              </Link>
            ) : (
              <span className="text-sm font-medium truncate">{member.name}</span>
            )}
            {member.leaderSlot === 'LEADER' && (
              <span title="Team Leader">
                <Crown className="h-3 w-3 text-primary shrink-0" />
              </span>
            )}
            {(member.leaderSlot === 'TEMP_1' || member.leaderSlot === 'TEMP_2') && (
              <span title="Temp Leader">
                <ShieldHalf className="h-3 w-3 text-primary shrink-0" />
              </span>
            )}
            {member.stateMismatch && (
              <span title="Availability status disagrees with derived assignment state">
                <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
              </span>
            )}
          </div>
          {member.position && <p className="text-xs text-muted-foreground truncate">{member.position}</p>}
        </div>
      </div>
      <div className="flex w-full flex-wrap gap-1 md:w-auto">
        {member.clients.length === 0 ? (
          <span className="text-xs text-muted-foreground/60">No client</span>
        ) : (
          // Index in the key: one VA can hold two engagements with the same client.
          member.clients.map((c, i) => (
            <Badge key={`${c.id}:${i}`} variant="secondary" className="text-[10px] gap-1" title={`${c.agreedHours}h agreed`}>
              {c.name}
              <span className="text-muted-foreground tabular-nums">{c.agreedHours}h</span>
            </Badge>
          ))
        )}
      </div>
      <div className="w-32 md:w-auto">
        <HoursCell member={member} />
      </div>
      <StatusIndicator tone={STATE_TONE[member.state]}>{STATE_LABEL[member.state]}</StatusIndicator>
      {action && <div className="ml-auto md:ml-0 md:justify-self-end">{action}</div>}
    </div>
  )
}

// `flat` drops the collapse affordance — used when the viewer only has the one
// team (a Team Leader), where hiding it would leave an empty page.
export function TeamAssignmentCard({
  team,
  collapsed = false,
  onToggle,
  flat = false,
  id,
}: {
  team: TeamAssignmentSummary
  collapsed?: boolean
  onToggle?: () => void
  flat?: boolean
  id?: string
}) {
  const clientCount = new Set(team.members.flatMap((m) => m.clients.map((c) => c.id))).size
  const isCollapsed = !flat && collapsed

  const header = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UsersRound className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <Link
            href={`/teams/${team.teamId}`}
            className="group/team inline-flex items-center gap-1 text-sm font-semibold hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {team.teamName}
            <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover/team:opacity-100" />
          </Link>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {team.counts.total} member{team.counts.total === 1 ? '' : 's'}
            {` · ${clientCount} client${clientCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <LeaderChip person={team.leader} icon={Crown} label="Team Leader" />
        <LeaderChip person={team.tempLeader1} icon={ShieldHalf} label="Temp Leader 1" />
        <LeaderChip person={team.tempLeader2} icon={ShieldHalf} label="Temp Leader 2" />
      </div>
      <div className="ml-auto flex items-center gap-3 text-xs">
        <StatusIndicator tone="success">{team.counts.active} active</StatusIndicator>
        <StatusIndicator tone="info">{team.counts.idle} idle</StatusIndicator>
        <StatusIndicator tone="warning">{team.counts.unavailable} unavailable</StatusIndicator>
        {!flat && (
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isCollapsed && '-rotate-90')} />
        )}
      </div>
    </>
  )

  return (
    <section id={id} className="rounded-lg border bg-card overflow-hidden scroll-mt-28">
      {flat ? (
        <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3 bg-muted/20 border-b">{header}</div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!isCollapsed}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle?.()
            }
          }}
          className={cn(
            'flex w-full cursor-pointer flex-wrap items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors text-left',
            !isCollapsed && 'border-b'
          )}
        >
          {header}
        </div>
      )}

      {!isCollapsed &&
        (team.members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No members match the current filters.</div>
        ) : (
          <>
            <MemberListHeader />
            <div className="divide-y">
              {team.members.map((m) => (
                <MemberRow key={m.userId} member={m} />
              ))}
            </div>
          </>
        ))}
    </section>
  )
}
