'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronDown, LayoutGrid, LayoutList } from 'lucide-react'
import { ClientCard, type ClientCardData } from '@/components/clients/ClientCard'
import { ClientListTable } from '@/components/clients/ClientListTable'

export type ClientBoardData = ClientCardData & {
  department: { id: string; name: string; sortOrder: number } | null
}

const VIEW_MODE_STORAGE_KEY = 'clients-view-mode'
const COLLAPSED_DEPARTMENTS_STORAGE_KEY = 'clients-collapsed-departments'
const NO_DEPARTMENT_KEY = '__none__'

type ViewMode = 'cards' | 'list'

function groupByDepartment(clients: ClientBoardData[]) {
  const groups = new Map<string, { key: string; name: string; sortOrder: number; clients: ClientBoardData[] }>()
  for (const c of clients) {
    const key = c.department?.id ?? NO_DEPARTMENT_KEY
    const existing = groups.get(key)
    if (existing) {
      existing.clients.push(c)
    } else {
      groups.set(key, {
        key,
        name: c.department?.name ?? 'No Department',
        sortOrder: c.department?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        clients: [c],
      })
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === NO_DEPARTMENT_KEY) return 1
    if (b.key === NO_DEPARTMENT_KEY) return -1
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  })
}

export function ClientsBoard({ clients }: { clients: ClientBoardData[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const storedView = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    if (storedView === 'cards' || storedView === 'list') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted UI state after mount, unavoidable since localStorage isn't available during SSR
      setViewMode(storedView)
    }
    const storedCollapsed = window.localStorage.getItem(COLLAPSED_DEPARTMENTS_STORAGE_KEY)
    if (storedCollapsed) {
      try {
        setCollapsed(new Set(JSON.parse(storedCollapsed)))
      } catch {
        // ignore malformed stored value
      }
    }
  }, [])

  const groups = useMemo(() => groupByDepartment(clients), [clients])

  const changeView = (mode: ViewMode) => {
    setViewMode(mode)
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }

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
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1">
        <div className="inline-flex items-center rounded-md border bg-card p-0.5">
          <Button
            type="button"
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2 gap-1.5 text-xs"
            onClick={() => changeView('cards')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </Button>
          <Button
            type="button"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2 gap-1.5 text-xs"
            onClick={() => changeView('list')}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </Button>
        </div>
      </div>

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
              viewMode === 'cards' ? (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 fade-in-stagger">
                  {group.clients.map((c) => (
                    <ClientCard key={c.id} c={c} />
                  ))}
                </div>
              ) : (
                <ClientListTable clients={group.clients} />
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
