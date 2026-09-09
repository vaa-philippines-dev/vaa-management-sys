'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Crown, ShieldHalf, ChevronDown, AlertTriangle, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TeamAssignmentSummary, TeamMemberAssignmentRow, VAAssignmentState } from '@/lib/team-assignments'
import type { PersonRef } from '@/lib/structure'

const STATE_TONE: Record<VAAssignmentState, 'success' | 'info' | 'warning'> = {
  ACTIVE: 'success',
  IDLE: 'info',
  UNAVAILABLE: 'warning',
}

const STATE_LABEL: Record<VAAssignmentState, string> = {
  ACTIVE: 'Active',
  IDLE: 'Idle',
  UNAVAILABLE: 'Unavailable',
}

function leaderName(person: PersonRef) {
  return `${person.firstName} ${person.lastName}`
}

function LeaderChip({ person, icon: Icon }: { person: PersonRef | null; icon: React.ComponentType<{ className?: string }> }) {
  if (!person) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground/60">
        <Icon className="h-2.5 w-2.5" />
        Vacant
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <Icon className="h-2.5 w-2.5" />
      {leaderName(person)}
    </Badge>
  )
}

export function MemberRow({ member }: { member: TeamMemberAssignmentRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {member.vaProfileId ? (
            <Link href={`/vas/${member.vaProfileId}`} className="text-sm font-medium truncate hover:underline">
              {member.name}
            </Link>
          ) : (
            <span className="text-sm font-medium truncate">{member.name}</span>
          )}
          {member.leaderSlot === 'LEADER' && <Crown className="h-3 w-3 text-primary shrink-0" />}
          {(member.leaderSlot === 'TEMP_1' || member.leaderSlot === 'TEMP_2') && (
            <ShieldHalf className="h-3 w-3 text-primary shrink-0" />
          )}
          {member.stateMismatch && (
            <span title="Availability status disagrees with derived assignment state">
              <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
            </span>
          )}
        </div>
        {member.position && <p className="text-xs text-muted-foreground truncate">{member.position}</p>}
      </div>
      <div className="flex flex-wrap gap-1 max-w-[40%] justify-end">
        {member.clients.length === 0 ? (
          <span className="text-xs text-muted-foreground/60">No client</span>
        ) : (
          member.clients.map((c) => (
            <Badge key={c.id} variant="secondary" className="text-[10px]">
              {c.name}
            </Badge>
          ))
        )}
      </div>
      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
        {member.totalAgreedHours}
        {member.capacityHours != null ? ` / ${member.capacityHours}h` : 'h'}
      </span>
      <StatusIndicator tone={STATE_TONE[member.state]} className="w-24 shrink-0">
        {STATE_LABEL[member.state]}
      </StatusIndicator>
    </div>
  )
}

export function TeamAssignmentCard({ team }: { team: TeamAssignmentSummary }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
      >
        <Link href={`/teams/${team.teamId}`} className="flex items-center gap-2 hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
          <UsersRound className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{team.teamName}</span>
        </Link>
        <div className="flex flex-wrap gap-1.5">
          <LeaderChip person={team.leader} icon={Crown} />
          <LeaderChip person={team.tempLeader1} icon={ShieldHalf} />
          <LeaderChip person={team.tempLeader2} icon={ShieldHalf} />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {team.counts.active} active · {team.counts.idle} idle · {team.counts.total} total
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
      </button>

      {!collapsed &&
        (team.members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No members match the current filters.</div>
        ) : (
          <div className="divide-y">
            {team.members.map((m) => (
              <MemberRow key={m.userId} member={m} />
            ))}
          </div>
        ))}
    </div>
  )
}
