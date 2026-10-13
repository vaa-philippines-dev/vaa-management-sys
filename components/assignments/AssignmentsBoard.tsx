'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Briefcase, CircleCheck, PauseCircle, CircleSlash, Flag, Clock, LayoutGrid, LayoutList, Search, X } from 'lucide-react'
import { AssignmentCard, ASSIGNMENT_STATUS_LABEL, type AssignmentRow } from './AssignmentCard'
import { AssignmentListTable, type AssignmentSort, type AssignmentSortKey } from './AssignmentListTable'

const VIEW_MODE_STORAGE_KEY = 'assignments-view-mode'
const PAGE_SIZE = 100

type ViewMode = 'cards' | 'list'
type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
type TypeFilter = 'ALL' | 'REGULAR' | 'PROJECT'

// "Paused" folds in ON_HOLD — both mean the engagement is on ice, not over.
const STATUS_MATCH: Record<Exclude<StatusFilter, 'ALL'>, string[]> = {
  ACTIVE: ['ACTIVE'],
  PAUSED: ['PAUSED', 'ON_HOLD'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED'],
}

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PAUSED: 1, ON_HOLD: 2, COMPLETED: 3, CANCELLED: 4 }

const SORT_LABEL: Record<AssignmentSortKey, string> = {
  status: 'Status',
  start: 'Start date',
  client: 'Client',
  va: 'VA',
  agreed: 'Agreed hours',
  logged: 'Logged hours',
}

const selectClass =
  'h-8 rounded-md border border-input bg-background px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function compare(a: AssignmentRow, b: AssignmentRow, key: AssignmentSortKey) {
  switch (key) {
    case 'client':
      return a.clientName.localeCompare(b.clientName)
    case 'va':
      return a.vaName.localeCompare(b.vaName)
    case 'status':
      return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.startTime - a.startTime
    case 'agreed':
      return a.agreedHours - b.agreedHours
    case 'logged':
      return a.loggedHours - b.loggedHours
    case 'start':
      return a.startTime - b.startTime
  }
}

// Everything a row can be found by. Each word of the query must match
// somewhere, so "amazon maria" finds Maria's Amazon engagements.
function searchText(r: AssignmentRow) {
  return [
    r.clientName,
    r.clientCompany,
    r.vaName,
    r.departmentName,
    ASSIGNMENT_STATUS_LABEL[r.status] ?? r.status,
    r.type === 'PROJECT' ? 'project' : 'regular',
    r.isAdditional ? 'additional hours' : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function parseParam<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function FilterTile({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  active?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg bg-muted transition-transform',
            onClick && 'group-hover/tile:scale-110',
            active && 'bg-primary/15 text-primary'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </>
  )
  const base = 'rounded-xl border bg-gradient-to-br from-card to-muted/40 p-4 text-left'
  if (!onClick) return <div className={base}>{body}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(base, 'group/tile card-hover transition-all', active && 'border-primary/50 ring-2 ring-primary/20')}
    >
      {body}
    </button>
  )
}

export function AssignmentsBoard({
  rows,
  showDepartment,
  showVA,
}: {
  rows: AssignmentRow[]
  showDepartment: boolean
  showVA: boolean
}) {
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [status, setStatus] = useState<StatusFilter>(() =>
    parseParam(searchParams.get('status'), ['ALL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const, 'ALL')
  )
  const [type, setType] = useState<TypeFilter>(() =>
    parseParam(searchParams.get('type'), ['ALL', 'REGULAR', 'PROJECT'] as const, 'ALL')
  )
  const [department, setDepartment] = useState(() => searchParams.get('dept') ?? 'all')
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [sort, setSort] = useState<AssignmentSort>({ key: 'status', dir: 'asc' })
  const [limit, setLimit] = useState(PAGE_SIZE)
  const searchRef = useRef<HTMLInputElement>(null)

  // "/" jumps to the search box from anywhere on the page (unless already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    if (stored === 'cards' || stored === 'list') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted UI state after mount, unavoidable since localStorage isn't available during SSR
      setViewMode(stored)
    }
  }, [])

  // Mirror the filters into the URL (without a server round trip) so a
  // filtered view survives a refresh and can be shared.
  useEffect(() => {
    const params = new URLSearchParams()
    if (status !== 'ALL') params.set('status', status)
    if (type !== 'ALL') params.set('type', type)
    if (department !== 'all') params.set('dept', department)
    if (search.trim()) params.set('q', search.trim())
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [status, type, department, search])

  const departments = useMemo(
    () => Array.from(new Set(rows.map((r) => r.departmentName).filter((d): d is string => !!d))).sort(),
    [rows]
  )

  // Everything except the status filter — the status tiles count within this.
  const searchIndex = useMemo(() => new Map(rows.map((r) => [r.id, searchText(r)])), [rows])

  const baseRows = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      if (type !== 'ALL' && r.type !== type) return false
      if (department !== 'all' && r.departmentName !== department) return false
      if (terms.length === 0) return true
      const text = searchIndex.get(r.id) ?? ''
      return terms.every((t) => text.includes(t))
    })
  }, [rows, type, department, search, searchIndex])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { ALL: baseRows.length, ACTIVE: 0, PAUSED: 0, COMPLETED: 0, CANCELLED: 0 }
    for (const r of baseRows) {
      for (const [key, statuses] of Object.entries(STATUS_MATCH)) {
        if (statuses.includes(r.status)) counts[key as StatusFilter] += 1
      }
    }
    return counts
  }, [baseRows])

  const typeCounts = useMemo(
    () => ({
      ALL: rows.length,
      REGULAR: rows.filter((r) => r.type === 'REGULAR').length,
      PROJECT: rows.filter((r) => r.type === 'PROJECT').length,
    }),
    [rows]
  )

  const activeHours = useMemo(
    () => baseRows.filter((r) => r.status === 'ACTIVE').reduce((s, r) => s + r.agreedHours, 0),
    [baseRows]
  )

  const visible = useMemo(() => {
    const filtered = status === 'ALL' ? baseRows : baseRows.filter((r) => STATUS_MATCH[status].includes(r.status))
    const sorted = [...filtered].sort((a, b) => compare(a, b, sort.key))
    return sort.dir === 'desc' ? sorted.reverse() : sorted
  }, [baseRows, status, sort])

  // Back to the first page whenever the result set changes shape.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting pagination when filters change
    setLimit(PAGE_SIZE)
  }, [status, type, department, search, sort])

  const changeView = (mode: ViewMode) => {
    setViewMode(mode)
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }

  const onSort = (key: AssignmentSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'agreed' || key === 'logged' || key === 'start' ? 'desc' : 'asc' }
    )
  }

  const toggleStatus = (value: StatusFilter) => setStatus((prev) => (prev === value ? 'ALL' : value))

  const filtersOn = status !== 'ALL' || type !== 'ALL' || department !== 'all' || search.trim() !== ''
  const shown = visible.slice(0, limit)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fade-in-stagger">
        <FilterTile icon={Briefcase} label="All" value={statusCounts.ALL} active={status === 'ALL'} onClick={() => setStatus('ALL')} />
        <FilterTile icon={CircleCheck} label="Active" value={statusCounts.ACTIVE} active={status === 'ACTIVE'} onClick={() => toggleStatus('ACTIVE')} />
        <FilterTile icon={PauseCircle} label="Paused / On Hold" value={statusCounts.PAUSED} active={status === 'PAUSED'} onClick={() => toggleStatus('PAUSED')} />
        <FilterTile icon={Flag} label="Completed" value={statusCounts.COMPLETED} active={status === 'COMPLETED'} onClick={() => toggleStatus('COMPLETED')} />
        <FilterTile icon={CircleSlash} label="Cancelled" value={statusCounts.CANCELLED} active={status === 'CANCELLED'} onClick={() => toggleStatus('CANCELLED')} />
        <FilterTile icon={Clock} label="Active Agreed Hours" value={`${Math.round(activeHours * 10) / 10}h`} />
      </div>

      <div className="sticky -top-6 z-20 -mx-6 flex flex-wrap items-center gap-2 border-b bg-background/85 px-6 py-2 backdrop-blur-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearch('')
                e.currentTarget.blur()
              }
            }}
            placeholder={showVA ? 'Search client, VA, department, status…' : 'Search client, department, status…'}
            aria-label="Search assignments"
            className="h-8 pl-8 pr-8 text-xs [&::-webkit-search-cancel-button]:hidden"
          />
          {!search && (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          )}
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

        <div className="inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5" role="group" aria-label="Assignment type">
          {(['ALL', 'REGULAR', 'PROJECT'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors',
                type === t ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {t === 'ALL' ? 'All types' : t === 'REGULAR' ? 'Regular' : 'Projects'}
              <span className={cn('text-[10px] tabular-nums', type === t ? 'opacity-80' : 'text-muted-foreground/70')}>
                {typeCounts[t]}
              </span>
            </button>
          ))}
        </div>

        {showDepartment && departments.length > 1 && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass} aria-label="Department">
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        {viewMode === 'cards' && (
          <select
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(':') as [AssignmentSortKey, 'asc' | 'desc']
              setSort({ key, dir })
            }}
            className={selectClass}
            aria-label="Sort"
          >
            {(Object.keys(SORT_LABEL) as AssignmentSortKey[]).flatMap((k) => [
              <option key={`${k}:asc`} value={`${k}:asc`}>
                Sort: {SORT_LABEL[k]} ↑
              </option>,
              <option key={`${k}:desc`} value={`${k}:desc`}>
                Sort: {SORT_LABEL[k]} ↓
              </option>,
            ])}
          </select>
        )}

        {filtersOn && (
          <button
            type="button"
            onClick={() => {
              setStatus('ALL')
              setType('ALL')
              setDepartment('all')
              setSearch('')
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset filters
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {visible.length === rows.length ? `${rows.length} assignments` : `${visible.length} of ${rows.length} assignments`}
        </span>
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

      {visible.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No assignments match these filters.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6 fade-in-stagger">
          {shown.map((a) => (
            <AssignmentCard key={a.id} a={a} showVA={showVA} />
          ))}
        </div>
      ) : (
        <AssignmentListTable
          assignments={shown}
          sort={sort}
          onSort={onSort}
          showDepartment={showDepartment && departments.length > 1}
          showVA={showVA}
          showType={type === 'ALL' && typeCounts.PROJECT > 0}
        />
      )}

      {visible.length > shown.length && (
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, visible.length - shown.length)} more
          </Button>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Showing {shown.length} of {visible.length}
          </span>
        </div>
      )}
    </div>
  )
}
