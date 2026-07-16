'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UsersRound, Building2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TeamListRow = {
  id: string
  name: string
  department: { name: string }
  _count?: { memberships: number }
}

type SortMode = 'name' | 'members'

export function TeamsBrowser({ teams }: { teams: TeamListRow[] }) {
  const [department, setDepartment] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const departments = useMemo(() => {
    const set = new Set(teams.map((t) => t.department.name))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [teams])

  const filtered = useMemo(
    () => (department === 'all' ? teams : teams.filter((t) => t.department.name === department)),
    [teams, department]
  )

  const groups = useMemo(() => {
    const byDept = new Map<string, TeamListRow[]>()
    for (const t of filtered) {
      const key = t.department.name
      if (!byDept.has(key)) byDept.set(key, [])
      byDept.get(key)!.push(t)
    }

    const sortTeams = (list: TeamListRow[]) => {
      const copy = [...list]
      if (sortMode === 'members') copy.sort((a, b) => (b._count?.memberships ?? 0) - (a._count?.memberships ?? 0))
      else copy.sort((a, b) => a.name.localeCompare(b.name))
      return copy
    }

    return Array.from(byDept.entries())
      .map(([departmentName, list]) => ({ departmentName, teams: sortTeams(list) }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
  }, [filtered, sortMode])

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
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
          <p className="text-xs text-muted-foreground mt-1">Create a team to start organizing members.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {departments.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            <option value="all">All departments ({teams.length})</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d} ({teams.filter((t) => t.department.name === d).length})
              </option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            <option value="name">Sort: Name (A–Z)</option>
            <option value="members">Sort: Most members</option>
          </select>

          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} team{filtered.length === 1 ? '' : 's'} across {groups.length} department{groups.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.departmentName)
          return (
            <div key={group.departmentName} className="rounded-lg border bg-card overflow-hidden">
              {departments.length > 1 && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.departmentName)}
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
              )}

              {!isCollapsed && (
                <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger', departments.length > 1 && 'p-4')}>
                  {group.teams.map((t) => (
                    <Link key={t.id} href={`/teams/${t.id}`}>
                      <Card className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                                <UsersRound className="h-4 w-4" />
                              </div>
                              <CardTitle className="text-base font-semibold truncate">{t.name}</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">{t.department.name}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          {t._count?.memberships ?? 0} member{(t._count?.memberships ?? 0) === 1 ? '' : 's'}
                        </CardContent>
                      </Card>
                    </Link>
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
