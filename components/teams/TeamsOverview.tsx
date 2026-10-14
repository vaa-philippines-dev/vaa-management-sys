'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Building2, ChevronDown, ChevronRight, Crown, Search, UserX, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TeamOverview } from '@/lib/teams-overview'

type SortMode = 'name' | 'attention' | 'members' | 'idle'

// How much a team needs the manager: check-ins missed in the last 30 days,
// people who left VAA still on the roster, and no leader.
function attentionScore(t: TeamOverview): number {
  return t.overdueCheckIns + t.leftVaa + (t.leaderName ? 0 : 1)
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
}

const selectClass =
  'h-8 rounded-md border border-input bg-background px-2 text-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none'

// The Dept/Ops Manager (and admin) view of /teams: every team as a card with
// how its people are deployed and what needs attention.
export function TeamsOverview({ teams }: { teams: TeamOverview[] }) {
  const [department, setDepartment] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const departments = useMemo(
    () => Array.from(new Set(teams.map((t) => t.departmentName))).sort((a, b) => a.localeCompare(b)),
    [teams]
  )
  const multiDept = departments.length > 1
  const attentionCount = teams.filter((t) => attentionScore(t) > 0).length

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = teams.filter(
      (t) =>
        (department === 'all' || t.departmentName === department) &&
        (!attentionOnly || attentionScore(t) > 0) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          (t.leaderName ?? '').toLowerCase().includes(q) ||
          t.memberNames.some((n) => n.toLowerCase().includes(q)))
    )
    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'attention') return attentionScore(b) - attentionScore(a) || a.name.localeCompare(b.name)
      if (sortMode === 'members') return b.members - a.members || a.name.localeCompare(b.name)
      if (sortMode === 'idle') return b.idle - a.idle || a.name.localeCompare(b.name)
      return a.name.localeCompare(b.name)
    })
    const byDept = new Map<string, TeamOverview[]>()
    for (const t of sorted) byDept.set(t.departmentName, [...(byDept.get(t.departmentName) ?? []), t])
    return Array.from(byDept.entries())
      .map(([departmentName, list]) => ({ departmentName, teams: list }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
  }, [teams, department, attentionOnly, search, sortMode])

  const shownCount = groups.reduce((s, g) => s + g.teams.length, 0)

  const toggleGroup = (name: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
            <UsersRound className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">No teams yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a team to start organizing members.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, leader or member…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        {multiDept && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
            <option value="all">All departments ({teams.length})</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d} ({teams.filter((t) => t.departmentName === d).length})
              </option>
            ))}
          </select>
        )}
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className={selectClass}>
          <option value="name">Sort: Name (A–Z)</option>
          <option value="attention">Sort: Needs attention</option>
          <option value="members">Sort: Most members</option>
          <option value="idle">Sort: Most idle VAs</option>
        </select>
        {attentionCount > 0 && (
          <Button variant={attentionOnly ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setAttentionOnly((v) => !v)}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Needs attention ({attentionCount})
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {shownCount} of {teams.length} team{teams.length === 1 ? '' : 's'}
        </span>
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No teams match these filters.
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.departmentName)
          return (
            <div key={group.departmentName} className={cn(multiDept && 'rounded-lg border bg-muted/30 overflow-hidden')}>
              {multiDept && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.departmentName)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold truncate">{group.departmentName}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {group.teams.length} team{group.teams.length === 1 ? '' : 's'}
                  </Badge>
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform shrink-0', isCollapsed && '-rotate-90')}
                  />
                </button>
              )}
              {!isCollapsed && (
                <div
                  className={cn(
                    'grid gap-4 md:grid-cols-2 xl:grid-cols-3 min-[1920px]:grid-cols-4 fade-in-stagger',
                    multiDept && 'p-4'
                  )}
                >
                  {group.teams.map((t) => (
                    <TeamCard key={t.id} team={t} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamCard({ team: t }: { team: TeamOverview }) {
  const pct = (n: number) => (t.members > 0 ? (n / t.members) * 100 : 0)
  const shownMembers = t.memberNames.slice(0, 5)
  const hiddenMembers = t.memberNames.length - shownMembers.length

  return (
    <Link href={`/teams/${t.id}`} className="group block">
      <Card className="h-full border bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
        <CardContent className="space-y-4 pt-5">
          {/* Name + leaders */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold truncate group-hover:text-primary transition-colors">{t.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <Crown className={cn('h-3.5 w-3.5 shrink-0', t.leaderName ? 'text-primary' : 'text-muted-foreground/40')} />
                <span className="truncate">{t.leaderName ?? 'No leader'}</span>
              </p>
              {t.tempLeaderNames.length > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground/80 truncate pl-5">
                  Temp: {t.tempLeaderNames.join(', ')}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>

          {/* Deployment bar */}
          <div className="space-y-1.5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="bg-success" style={{ width: `${pct(t.active)}%` }} />
              <div className="bg-info" style={{ width: `${pct(t.idle)}%` }} />
              <div className="bg-warning" style={{ width: `${pct(t.unavailable)}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> {t.active} active
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-info" /> {t.idle} idle
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> {t.unavailable} unavailable
              </span>
            </div>
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/20 text-center">
            <Metric value={t.members} label="Members" />
            <Metric value={t.clients} label="Clients" />
            <Metric value={Math.round(t.hours * 10) / 10} label="Hours" />
          </div>

          {/* Members + flags */}
          <div className="flex items-center justify-between gap-2 min-h-6">
            <div className="flex -space-x-1.5">
              {shownMembers.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  title={name}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[9px] font-semibold text-primary"
                >
                  {initials(name)}
                </span>
              ))}
              {hiddenMembers > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-muted px-1 text-[9px] font-semibold text-muted-foreground">
                  +{hiddenMembers}
                </span>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {t.overdueCheckIns > 0 && (
                <Badge
                  variant="outline"
                  title="KPI check-ins that came due in the last 30 days and weren't marked done"
                  className="gap-1 border-warning/40 text-warning text-[10px]"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {t.overdueCheckIns} missed check-in{t.overdueCheckIns === 1 ? '' : 's'}
                </Badge>
              )}
              {t.leftVaa > 0 && (
                <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive text-[10px]">
                  <UserX className="h-3 w-3" />
                  {t.leftVaa} left VAA
                </Badge>
              )}
              {!t.leaderName && (
                <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">
                  No leader
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2 py-2">
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}
