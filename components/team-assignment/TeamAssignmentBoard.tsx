'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, ChevronsDownUp, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TeamAssignmentSummary, TeamMemberAssignmentRow } from '@/lib/team-assignments'
import { TeamAssignmentCard } from './TeamAssignmentCard'
import { UnassignedVAsCard } from './UnassignedVAsCard'

const UNASSIGNED_KEY = '__unassigned__'
const sectionId = (key: string) => `team-assignment-${key}`

type SortMode = 'roster' | 'name' | 'hours' | 'state'

const SORT_LABEL: Record<SortMode, string> = {
  roster: 'Roster order',
  name: 'Name (A–Z)',
  hours: 'Most hours assigned',
  state: 'Status',
}

const STATE_ORDER = { ACTIVE: 0, IDLE: 1, UNAVAILABLE: 2 } as const

function sortMembers(members: TeamMemberAssignmentRow[], mode: SortMode) {
  if (mode === 'roster') return members
  const copy = [...members]
  if (mode === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
  else if (mode === 'hours') copy.sort((a, b) => b.totalAgreedHours - a.totalAgreedHours || a.name.localeCompare(b.name))
  else copy.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name))
  return copy
}

function matches(m: TeamMemberAssignmentRow, q: string) {
  return (
    m.name.toLowerCase().includes(q) ||
    (m.position ?? '').toLowerCase().includes(q) ||
    m.clients.some((c) => c.name.toLowerCase().includes(q))
  )
}

const selectClass =
  'h-8 rounded-md border border-input bg-background px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function TeamAssignmentBoard({
  teams,
  unassigned,
  assignableTeams,
  singleTeam,
}: {
  teams: TeamAssignmentSummary[]
  unassigned: TeamMemberAssignmentRow[]
  // Teams an unassigned VA can be put on; empty for read-only viewers.
  assignableTeams: { id: string; name: string }[]
  // A Team Leader's own (only) team: render it open, no collapse/jump chrome.
  singleTeam: boolean
}) {
  const [search, setSearch] = useState('')
  const [mismatchOnly, setMismatchOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('roster')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const q = search.trim().toLowerCase()
  const filterMembers = (members: TeamMemberAssignmentRow[]) =>
    sortMembers(
      members.filter((m) => (!mismatchOnly || m.stateMismatch) && (!q || matches(m, q))),
      sortMode
    )

  const visibleTeams = useMemo(
    () =>
      teams
        .map((t) => ({ ...t, members: filterMembers(t.members) }))
        // Keep empty teams visible when nothing is being narrowed, so a new
        // team with no roster yet still shows up.
        .filter((t) => t.members.length > 0 || (!q && !mismatchOnly)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, q, mismatchOnly, sortMode]
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleUnassigned = useMemo(() => filterMembers(unassigned), [unassigned, q, mismatchOnly, sortMode])

  const mismatchCount = useMemo(
    () => teams.reduce((n, t) => n + t.members.filter((m) => m.stateMismatch).length, 0) + unassigned.filter((m) => m.stateMismatch).length,
    [teams, unassigned]
  )

  const sectionKeys = [...visibleTeams.map((t) => t.teamId), ...(visibleUnassigned.length > 0 ? [UNASSIGNED_KEY] : [])]
  const allCollapsed = sectionKeys.length > 0 && sectionKeys.every((k) => collapsed.has(k))

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const jumpTo = (key: string) => {
    if (collapsed.has(key)) toggle(key)
    requestAnimationFrame(() => {
      document.getElementById(sectionId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const filtersOn = q !== '' || mismatchOnly
  const showJump = !singleTeam && sectionKeys.length > 1

  return (
    <div className="space-y-4">
      <div className="sticky -top-6 z-20 -mx-6 space-y-2 border-b bg-background/85 px-6 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search VA, position or client…"
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
          {mismatchCount > 0 && (
            <Button
              type="button"
              variant={mismatchOnly ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setMismatchOnly((v) => !v)}
              aria-pressed={mismatchOnly}
              title="Availability status disagrees with what their active assignments say"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Status mismatch ({mismatchCount})
            </Button>
          )}
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className={selectClass} aria-label="Sort members">
            {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
              <option key={m} value={m}>
                Sort: {SORT_LABEL[m]}
              </option>
            ))}
          </select>
          {filtersOn && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setMismatchOnly(false)
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}
          {!singleTeam && sectionKeys.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 gap-1.5 text-xs"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(sectionKeys))}
            >
              {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
          )}
        </div>

        {showJump && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 mr-1">Jump to</span>
            {visibleTeams.map((t) => (
              <button
                key={t.teamId}
                type="button"
                onClick={() => jumpTo(t.teamId)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-muted"
              >
                {t.teamName}
                <span className="text-[10px] text-muted-foreground tabular-nums">{t.members.length}</span>
              </button>
            ))}
            {visibleUnassigned.length > 0 && (
              <button
                type="button"
                onClick={() => jumpTo(UNASSIGNED_KEY)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-warning/50 bg-card px-2.5 py-0.5 text-xs font-medium text-warning transition-colors hover:bg-warning/10"
              >
                Unassigned
                <span className="text-[10px] tabular-nums">{visibleUnassigned.length}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {visibleTeams.length === 0 && visibleUnassigned.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No VAs match the current filters.</p>
        </div>
      ) : (
        <div className={cn('space-y-4', !singleTeam && 'fade-in-stagger')}>
          {visibleTeams.map((team) => (
            <TeamAssignmentCard
              key={team.teamId}
              id={sectionId(team.teamId)}
              team={team}
              flat={singleTeam}
              collapsed={collapsed.has(team.teamId)}
              onToggle={() => toggle(team.teamId)}
            />
          ))}
          {visibleUnassigned.length > 0 && (
            <UnassignedVAsCard
              id={sectionId(UNASSIGNED_KEY)}
              members={visibleUnassigned}
              teams={assignableTeams}
              collapsed={collapsed.has(UNASSIGNED_KEY)}
              onToggle={() => toggle(UNASSIGNED_KEY)}
            />
          )}
        </div>
      )}
    </div>
  )
}
