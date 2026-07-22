'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table'
import { ClientAdminRow, type ClientAdminData } from '@/components/clients/ClientAdminRow'

const COLLAPSED_DEPARTMENTS_STORAGE_KEY = 'admin-clients-collapsed-departments'
const NO_DEPARTMENT_KEY = '__none__'

function groupByDepartment(clients: ClientAdminData[]) {
  const groups = new Map<string, { key: string; name: string; clients: ClientAdminData[] }>()
  const order: string[] = []
  for (const c of clients) {
    const key = c.department?.id ?? NO_DEPARTMENT_KEY
    const existing = groups.get(key)
    if (existing) {
      existing.clients.push(c)
    } else {
      groups.set(key, { key, name: c.department?.name ?? 'No Department', clients: [c] })
      order.push(key)
    }
  }
  // Clients already arrive sorted by department.sortOrder from the query,
  // so groups only need "No Department" pushed to the end.
  return order
    .map((key) => groups.get(key)!)
    .sort((a, b) => (a.key === NO_DEPARTMENT_KEY ? 1 : b.key === NO_DEPARTMENT_KEY ? -1 : 0))
}

export function ClientAdminBoard({
  clients,
  departments,
  managers,
  skills,
  canEdit,
}: {
  clients: ClientAdminData[]
  departments: { id: string; name: string }[]
  managers: { id: string; firstName: string; lastName: string | null; email: string }[]
  skills: string[]
  canEdit: boolean
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSED_DEPARTMENTS_STORAGE_KEY)
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted UI state after mount, unavoidable since localStorage isn't available during SSR
        setCollapsed(new Set(JSON.parse(stored)))
      } catch {
        // ignore malformed stored value
      }
    }
  }, [])

  const groups = useMemo(() => groupByDepartment(clients), [clients])

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      window.localStorage.setItem(COLLAPSED_DEPARTMENTS_STORAGE_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key)
        return (
          <div key={group.key} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', isCollapsed && '-rotate-90')} />
              <span className="text-sm font-semibold">{group.name}</span>
              <span className="text-xs text-muted-foreground">{group.clients.length}</span>
            </button>

            {!isCollapsed && (
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="px-3 py-2.5">Name</TableHead>
                      <TableHead className="px-3 py-2.5">Platform</TableHead>
                      <TableHead className="px-3 py-2.5">Status</TableHead>
                      <TableHead className="px-3 py-2.5 hidden lg:table-cell">Contact</TableHead>
                      <TableHead className="px-3 py-2.5 hidden lg:table-cell">Manager</TableHead>
                      <TableHead className="px-3 py-2.5 text-right">Assignments</TableHead>
                      <TableHead className="px-3 py-2.5 w-0"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.clients.map((c) => (
                      <ClientAdminRow
                        key={c.id}
                        client={c}
                        departments={departments}
                        managers={managers}
                        skills={skills}
                        canEdit={canEdit}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
