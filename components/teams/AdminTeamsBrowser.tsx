'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DeleteTeamButton } from '@/components/teams/DeleteTeamButton'
import { UsersRound, Building2, Crown, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AdminTeamRow = {
  id: string
  name: string
  departmentId: string
  departmentName: string
  leaderName: string | null
  memberCount: number
}

type SortMode = 'department' | 'name' | 'members'

export function AdminTeamsBrowser({ teams, canDelete }: { teams: AdminTeamRow[]; canDelete: boolean }) {
  const [departmentId, setDepartmentId] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('department')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const departments = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of teams) map.set(t.departmentId, t.departmentName)
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [teams])

  const filtered = useMemo(
    () => (departmentId === 'all' ? teams : teams.filter((t) => t.departmentId === departmentId)),
    [teams, departmentId]
  )

  const groups = useMemo(() => {
    const byDept = new Map<string, { departmentId: string; departmentName: string; teams: AdminTeamRow[] }>()
    for (const t of filtered) {
      if (!byDept.has(t.departmentId)) {
        byDept.set(t.departmentId, { departmentId: t.departmentId, departmentName: t.departmentName, teams: [] })
      }
      byDept.get(t.departmentId)!.teams.push(t)
    }

    const sortTeams = (list: AdminTeamRow[]) => {
      const copy = [...list]
      if (sortMode === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
      else if (sortMode === 'members') copy.sort((a, b) => b.memberCount - a.memberCount)
      else copy.sort((a, b) => a.name.localeCompare(b.name))
      return copy
    }

    return Array.from(byDept.values())
      .map((g) => ({ ...g, teams: sortTeams(g.teams) }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
  }, [filtered, sortMode])

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
            <UsersRound className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">No teams yet</p>
          <p className="text-xs text-muted-foreground mt-1">Teams created across departments will appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <option value="all">All departments ({teams.length})</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({teams.filter((t) => t.departmentId === d.id).length})
            </option>
          ))}
        </select>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <option value="department">Sort: Name (A–Z)</option>
          <option value="members">Sort: Most members</option>
        </select>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} team{filtered.length === 1 ? '' : 's'} across {groups.length} department{groups.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.departmentId)
          return (
            <div key={group.departmentId} className="rounded-lg border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(group.departmentId)}
                className="flex w-full items-center gap-2 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
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

              {!isCollapsed && (
                <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.teams.map((t) => (
                    <div key={t.id} className="relative group">
                      <Link href={`/teams/${t.id}`}>
                        <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <UsersRound className="h-4 w-4" />
                                </div>
                                <CardTitle className="text-sm font-semibold truncate">{t.name}</CardTitle>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Crown className="h-3 w-3" />
                              <span className="truncate">{t.leaderName ?? 'Vacant'}</span>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <span>{t.memberCount} member{t.memberCount === 1 ? '' : 's'}</span>
                              {!t.leaderName && <Badge variant="outline" className="text-[9px]">No Leader</Badge>}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                      {canDelete && (
                        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DeleteTeamButton teamId={t.id} teamName={t.name} />
                        </div>
                      )}
                    </div>
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
