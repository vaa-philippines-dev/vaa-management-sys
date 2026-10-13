'use client'

import Link from 'next/link'
import { ChevronDown, UserRoundPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberListHeader, MemberRow } from './TeamAssignmentCard'
import { AddToTeamSelect } from '@/components/teams/AddToTeamSelect'
import type { TeamMemberAssignmentRow } from '@/lib/team-assignments'

// VAs actively in the department but on no active team roster — invisible on
// /teams today, so surfaced here as its own bucket. Managers can put each one
// on a team right from the row (`teams` is empty for read-only viewers).
export function UnassignedVAsCard({
  members,
  teams = [],
  collapsed = false,
  onToggle,
  id,
}: {
  members: TeamMemberAssignmentRow[]
  teams?: { id: string; name: string }[]
  collapsed?: boolean
  onToggle?: () => void
  id?: string
}) {
  const canAssign = teams.length > 0
  return (
    <section id={id} className="rounded-lg border border-dashed border-warning/40 bg-card overflow-hidden scroll-mt-28">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle?.()
          }
        }}
        className={cn(
          'flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 bg-warning/5 hover:bg-warning/10 transition-colors',
          !collapsed && 'border-b'
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <UserRoundPlus className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Unassigned VAs ({members.length})</p>
          <p className="text-[11px] text-muted-foreground">In this department but on no team roster</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {!canAssign && (
            <Link
              href="/teams"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Add to a team →
            </Link>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
        </div>
      </div>
      {!collapsed && (
        <>
          <MemberListHeader withAction={canAssign} />
          <div className="divide-y">
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                action={canAssign ? <AddToTeamSelect userId={m.userId} teams={teams} /> : undefined}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
