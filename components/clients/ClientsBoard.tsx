'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, LayoutGrid, LayoutList, UserRoundX } from 'lucide-react'
import { CLIENT_PLATFORM_META, clientDisplayName } from '@/lib/clients/display'
import { ClientCard, type ClientCardData } from '@/components/clients/ClientCard'
import { ClientListTable } from '@/components/clients/ClientListTable'

export type ClientBoardData = ClientCardData & {
  department: { id: string; name: string; sortOrder: number } | null
}

const VIEW_MODE_STORAGE_KEY = 'clients-view-mode'
const COLLAPSED_DEPARTMENTS_STORAGE_KEY = 'clients-collapsed-departments'
const NO_DEPARTMENT_KEY = '__none__'

type ViewMode = 'cards' | 'list'
type SortMode = 'newest' | 'name' | 'vas'

const SORT_LABEL: Record<SortMode, string> = {
  newest: 'Newest first',
  name: 'Name (A–Z)',
  vas: 'Most active VAs',
}

const selectClass =
  'h-8 rounded-md border border-input bg-background px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

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

function sortClients(clients: ClientBoardData[], mode: SortMode) {
  // 'newest' is the server's createdAt-desc order already.
  if (mode === 'newest') return clients
  const copy = [...clients]
  if (mode === 'name') copy.sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)))
  else copy.sort((a, b) => b.activeVAs.length - a.activeVAs.length || clientDisplayName(a).localeCompare(clientDisplayName(b)))
  return copy
}

const sectionId = (key: string) => `clients-dept-${key}`

export function ClientsBoard({ clients }: { clients: ClientBoardData[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [platform, setPlatform] = useState('all')
  const [noVAOnly, setNoVAOnly] = useState(false)

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

  const platforms = useMemo(() => Array.from(new Set(clients.map((c) => c.platform))).sort(), [clients])
  const noVACount = useMemo(() => clients.filter((c) => c.activeVAs.length === 0).length, [clients])

  const visible = useMemo(
    () =>
      clients.filter((c) => {
        if (noVAOnly && c.activeVAs.length > 0) return false
        if (platform !== 'all' && c.platform !== platform) return false
        return true
      }),
    [clients, noVAOnly, platform]
  )

  const groups = useMemo(
    () => groupByDepartment(visible).map((g) => ({ ...g, clients: sortClients(g.clients, sortMode) })),
    [visible, sortMode]
  )

  const changeView = (mode: ViewMode) => {
    setViewMode(mode)
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }

  const persistCollapsed = (next: Set<string>) => {
    window.localStorage.setItem(COLLAPSED_DEPARTMENTS_STORAGE_KEY, JSON.stringify(Array.from(next)))
    return next
  }

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return persistCollapsed(next)
    })
  }

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.key))
  const setAllCollapsed = (value: boolean) => {
    setCollapsed(persistCollapsed(value ? new Set(groups.map((g) => g.key)) : new Set()))
  }

  // Jumping to a department also opens it if it was collapsed.
  const jumpTo = (key: string) => {
    if (collapsed.has(key)) toggleGroup(key)
    requestAnimationFrame(() => {
      document.getElementById(sectionId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const filtersOn = noVAOnly || platform !== 'all'

  return (
    <div className="space-y-4">
      <div className="sticky -top-6 z-20 -mx-6 border-b bg-background/85 px-6 py-2 backdrop-blur-sm space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {noVACount > 0 && (
            <Button
              type="button"
              variant={noVAOnly ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setNoVAOnly((v) => !v)}
              aria-pressed={noVAOnly}
            >
              <UserRoundX className="h-3.5 w-3.5" />
              No active VA ({noVACount})
            </Button>
          )}
          {platforms.length > 1 && (
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectClass} aria-label="Platform">
              <option value="all">All platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {CLIENT_PLATFORM_META[p]?.label ?? p}
                </option>
              ))}
            </select>
          )}
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className={selectClass} aria-label="Sort">
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
                setNoVAOnly(false)
                setPlatform('all')
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}

          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {visible.length === clients.length ? `${clients.length} requests` : `${visible.length} of ${clients.length} requests`}
          </span>
          {groups.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setAllCollapsed(!allCollapsed)}
            >
              {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
          )}
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

        {groups.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 mr-1">Jump to</span>
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => jumpTo(g.key)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-muted"
              >
                {g.name}
                <span className="text-[10px] text-muted-foreground tabular-nums">{g.clients.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No client requests match these filters.
        </div>
      ) : (
        groups.map((group) => {
          const isCollapsed = collapsed.has(group.key)
          const groupNoVA = group.clients.filter((c) => c.activeVAs.length === 0).length
          return (
            <section key={group.key} id={sectionId(group.key)} className="space-y-2 scroll-mt-28">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', isCollapsed && '-rotate-90')} />
                <span className="text-sm font-semibold">{group.name}</span>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                  {group.clients.length}
                </span>
                {groupNoVA > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-warning">
                    <UserRoundX className="h-3 w-3" />
                    {groupNoVA} without an active VA
                  </span>
                )}
              </button>

              {!isCollapsed &&
                (viewMode === 'cards' ? (
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6 fade-in-stagger">
                    {group.clients.map((c) => (
                      <ClientCard key={c.id} c={c} />
                    ))}
                  </div>
                ) : (
                  <ClientListTable clients={group.clients} />
                ))}
            </section>
          )
        })
      )}
    </div>
  )
}
