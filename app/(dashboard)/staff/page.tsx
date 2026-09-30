import { getCurrentUser, STAFF_MUTATOR_ROLES } from '@/lib/auth'
import { getStaffPeople, type StaffPerson } from '@/lib/staff'
import {
  STAFF_STATUS_OPTIONS,
  STAFF_EMPLOYMENT_OPTIONS,
  STAFF_STATUS_TONE,
  STAFF_EMPLOYMENT_TONE,
  staffStatusTier,
  titleCase,
} from '@/lib/staff-fields'
import { redirect } from 'next/navigation'
import { isTeamScoped } from '@/lib/scope'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { StatCard } from '@/components/ui/stat-card'
import { Pagination } from '@/components/ui/pagination'
import { AddStaffBtn } from '@/components/staff/AddStaffBtn'
import { differenceInMonths } from 'date-fns'
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  LayoutList,
  PauseCircle,
  Pencil,
  UserCog,
  UserMinus,
  UserX,
  Users,
  UsersRound,
} from 'lucide-react'

const PAGE_SIZE = 20

type SortField = 'name' | 'position' | 'status' | 'employment' | 'hireDate' | 'eocDate'
const SORT_FIELDS: SortField[] = ['name', 'position', 'status', 'employment', 'hireDate', 'eocDate']
const DEFAULT_SORT = 'hireDate:desc'
const DEFAULT_STATUS = 'ACTIVE'

function parseSort(raw: string): { field: SortField; dir: 'asc' | 'desc' } {
  const [field, dir] = raw.split(':')
  return {
    field: SORT_FIELDS.includes(field as SortField) ? (field as SortField) : 'hireDate',
    dir: dir === 'asc' ? 'asc' : 'desc',
  }
}

// Sheet dates sit at UTC midnight (parseDmfDate) — format in UTC too.
const formatDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d) : null

function formatYearsOfService(from: Date | null, until: Date | null): string | null {
  if (!from) return null
  const months = differenceInMonths(until ?? new Date(), from)
  if (months < 0) return null
  const y = Math.floor(months / 12)
  const m = months % 12
  return y === 0 ? `${m}m` : m === 0 ? `${y}y` : `${y}y ${m}m`
}

const Empty = () => <span className="text-muted-foreground/50">—</span>

// The VA Masterlist, for internal staff: one row per person (their latest
// engagement), opening the Staff 201 at /staff/[id]. ~150 people, so it loads
// once and filters/sorts/pages in memory.
export default async function StaffMasterlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (currentUser.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')
  // Company-wide staff directory; a Team Leader's view stops at their own team.
  if (isTeamScoped(currentUser)) redirect('/tmf')

  const canEdit = STAFF_MUTATOR_ROLES.includes(currentUser.systemRole)

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim().toLowerCase() : ''
  const dept = typeof params.dept === 'string' ? params.dept : undefined
  const level = typeof params.level === 'string' ? params.level : undefined
  const emp = typeof params.emp === 'string' ? params.emp : undefined
  const statusParam = typeof params.status === 'string' ? params.status : DEFAULT_STATUS
  const status = statusParam === 'ALL' ? undefined : statusParam
  const sort = typeof params.sort === 'string' ? params.sort : DEFAULT_SORT
  const viewAll = params.view === 'all'
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)
  const { field: sortField, dir: sortDir } = parseSort(sort)

  const people = await getStaffPeople()
  const departments = [...new Set(people.map((p) => p.latest.department).filter(Boolean) as string[])].sort()
  const levels = [...new Set(people.map((p) => p.latest.level).filter(Boolean) as string[])].sort()

  const matches = (p: StaffPerson) => {
    const l = p.latest
    if (status && l.generalStatus !== status) return false
    if (dept && l.department !== dept) return false
    if (level && l.level !== level) return false
    if (emp && l.employmentStatus !== emp) return false
    if (q && ![p.name, l.staffId, l.workEmail, l.position, l.user?.email].some((v) => v?.toLowerCase().includes(q))) return false
    return true
  }
  const filtered = people.filter(matches)

  const mult = sortDir === 'asc' ? 1 : -1
  // Blank values sink to the bottom whichever way the column is sorted.
  const byNullable = <T,>(a: T | null, b: T | null, cmp: (x: T, y: T) => number) =>
    a == null || b == null ? (a == null ? (b == null ? 0 : 1) : -1) : cmp(a, b) * mult
  const str = (x: string, y: string) => x.localeCompare(y)
  const time = (x: Date, y: Date) => x.getTime() - y.getTime()
  filtered.sort((a, b) => {
    if (!status && sortField !== 'status') {
      const tier = staffStatusTier(a.latest.generalStatus) - staffStatusTier(b.latest.generalStatus)
      if (tier !== 0) return tier
    }
    const cmp =
      sortField === 'name' ? a.name.localeCompare(b.name) * mult :
      sortField === 'position' ? byNullable(a.latest.position, b.latest.position, str) :
      sortField === 'status' ? (staffStatusTier(a.latest.generalStatus) - staffStatusTier(b.latest.generalStatus) || (a.latest.generalStatus ?? '').localeCompare(b.latest.generalStatus ?? '')) * mult :
      sortField === 'employment' ? byNullable(a.latest.employmentStatus, b.latest.employmentStatus, str) :
      sortField === 'eocDate' ? byNullable(a.latest.eocDate, b.latest.eocDate, time) :
      byNullable(a.hireDate, b.hireDate, time)
    return cmp || a.name.localeCompare(b.name)
  })

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = viewAll ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = !!(q || dept || level || emp || statusParam !== DEFAULT_STATUS)

  // Scorecards cover the whole roster, independent of the table's filters.
  const count = (f: (p: StaffPerson) => boolean) => people.filter(f).length
  const stats = {
    total: people.length,
    active: count((p) => p.latest.generalStatus === 'ACTIVE'),
    alsoVA: count((p) => p.latest.generalStatus === 'ACTIVE' && p.latest.user?.userType === 'VIRTUAL_ASSISTANT'),
    onHold: count((p) => p.latest.generalStatus === 'ON HOLD'),
    eoc: count((p) => p.latest.employmentStatus === 'END OF CONTRACT'),
    offboarded: count((p) => p.latest.generalStatus === 'RESIGNED' || p.latest.generalStatus === 'REMOVED'),
  }

  type ParamsState = { q?: string; dept?: string; level?: string; emp?: string; status?: string; sort?: string; viewAll?: boolean; page?: number }
  const base: ParamsState = { q, dept, level, emp, status: statusParam, sort, viewAll, page }
  const buildParams = (overrides: Partial<ParamsState>) => {
    const m = { ...base, ...overrides }
    const sp = new URLSearchParams()
    if (m.q) sp.set('q', m.q)
    if (m.dept) sp.set('dept', m.dept)
    if (m.level) sp.set('level', m.level)
    if (m.emp) sp.set('emp', m.emp)
    sp.set('status', m.status ?? DEFAULT_STATUS)
    if (m.sort) sp.set('sort', m.sort)
    if (m.viewAll) sp.set('view', 'all')
    if (m.page && m.page > 1) sp.set('page', String(m.page))
    return `?${sp.toString()}`
  }
  const buildSortHref = (field: SortField) => {
    const dateField = field === 'hireDate' || field === 'eocDate'
    const nextDir = sortField === field ? (sortDir === 'desc' ? 'asc' : 'desc') : dateField ? 'desc' : 'asc'
    return buildParams({ sort: `${field}:${nextDir}`, page: undefined })
  }
  // `inverted` is for Yrs, which reuses the Hire Date sort with the arrow flipped.
  const sortIcon = (field: SortField, inverted = false) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
    return (sortDir === 'asc') !== inverted ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }
  const sortHead = (field: SortField, label: string, className = '', inverted = false) => (
    <TableHead className={`px-3 py-2.5 ${className}`}>
      <Link href={buildSortHref(field)} className="flex items-center gap-1 hover:text-foreground">
        {label} {sortIcon(field, inverted)}
      </Link>
    </TableHead>
  )

  return (
    <div data-wide-page className="space-y-3">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fade-in-stagger">
        <StatCard icon={Users} label="Total Staff" value={stats.total} href="/staff?status=ALL" />
        <StatCard icon={UserCog} label="Active" value={stats.active} href="/staff?status=ACTIVE" />
        <StatCard icon={UsersRound} label="Also VA (Team Leaders)" value={stats.alsoVA} />
        <StatCard icon={PauseCircle} label="On Hold" value={stats.onHold} href="/staff?status=ON%20HOLD" />
        <StatCard icon={UserMinus} label="EOC" value={stats.eoc} href="/staff?status=ALL&emp=END%20OF%20CONTRACT" />
        <StatCard icon={UserX} label="Resigned / Removed" value={stats.offboarded} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight">Staff Masterlist</h2>
          {canEdit && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-info/10 text-info border-info/20">HR View</Badge>
          )}
        </div>
        {canEdit && <AddStaffBtn departments={departments} />}
      </div>

      <div className="rounded-lg border bg-card p-2.5">
        <FilterBar
          filters={[
            {
              key: 'status',
              label: 'Status',
              defaultValue: DEFAULT_STATUS,
              options: [{ value: 'ALL', label: 'All Statuses' }, ...STAFF_STATUS_OPTIONS.map((s) => ({ value: s, label: titleCase(s) }))],
            },
            { key: 'dept', label: 'Dept', options: departments.map((d) => ({ value: d, label: d })) },
            { key: 'level', label: 'Level', options: levels.map((l) => ({ value: l, label: l })) },
            { key: 'emp', label: 'Emp', options: STAFF_EMPLOYMENT_OPTIONS.map((e) => ({ value: e, label: titleCase(e) })) },
          ]}
          searchPlaceholder="Search name, staff ID, email, or position..."
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {hasFilters ? `${filtered.length} / ${people.length}` : people.length} staff
          </span>
          <span className="flex items-center gap-1.5">
            <UserCog className="h-3 w-3" />
            {filtered.filter((p) => p.latest.generalStatus === 'ACTIVE').length} active
          </span>
        </div>
        {viewAll ? (
          <Link href={buildParams({ viewAll: false, page: undefined })} className="flex items-center gap-1.5 font-medium text-primary hover:underline">
            <LayoutList className="h-3 w-3" />
            Paginate ({PAGE_SIZE}/page)
          </Link>
        ) : (
          filtered.length > PAGE_SIZE && (
            <Link href={buildParams({ viewAll: true, page: undefined })} className="flex items-center gap-1.5 font-medium text-primary hover:underline">
              <LayoutList className="h-3 w-3" />
              View All
            </Link>
          )
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No staff match your filters</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-19rem)] overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="bg-muted/30">
                  {sortHead('name', 'Name', 'sticky left-0 bg-muted/30 z-10')}
                  <TableHead className="px-3 py-2.5 hidden md:table-cell">Work Email</TableHead>
                  <TableHead className="px-3 py-2.5 hidden lg:table-cell">Department</TableHead>
                  {sortHead('position', 'Position', 'hidden lg:table-cell')}
                  {sortHead('status', 'Status', 'hidden sm:table-cell')}
                  {sortHead('employment', 'Employment Status', 'hidden md:table-cell')}
                  {sortHead('hireDate', 'Hire Date', 'hidden md:table-cell')}
                  {sortHead('hireDate', 'Yrs', 'hidden xl:table-cell', true)}
                  {sortHead('eocDate', 'EOC Date', 'hidden md:table-cell')}
                  <TableHead className="px-3 py-2.5 hidden xl:table-cell">Remarks</TableHead>
                  <TableHead className="px-3 py-2.5 w-0"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const l = p.latest
                  const offboarded = l.generalStatus !== 'ACTIVE' && l.generalStatus !== 'ON HOLD'
                  return (
                    <TableRow key={p.id} className="hover:bg-accent/50 group">
                      <TableCell className="px-3 py-2.5 sticky left-0 bg-card group-hover:bg-accent/50 z-10 transition-colors">
                        <Link href={`/staff/${p.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary shrink-0">
                            {(l.firstName || 'S')[0].toUpperCase()}
                          </div>
                          <span className="font-medium">{p.name}</span>
                          {l.staffId && <span className="text-[10px] font-mono text-muted-foreground">{l.staffId}</span>}
                          {/* Team Leaders keep their VA account and also appear here. */}
                          {l.user?.userType === 'VIRTUAL_ASSISTANT' && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1">VA</Badge>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{l.workEmail ?? <Empty />}</TableCell>
                      <TableCell className="px-3 py-2.5 hidden lg:table-cell">
                        {l.department ? (
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">{l.department}</Badge>
                            {l.subdepartment && l.subdepartment !== l.department && (
                              <span className="text-[10px] text-muted-foreground">{l.subdepartment}</span>
                            )}
                          </span>
                        ) : <Empty />}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 hidden lg:table-cell">{l.position ?? <Empty />}</TableCell>
                      <TableCell className="px-3 py-2.5 hidden sm:table-cell">
                        {l.generalStatus ? (
                          <StatusIndicator tone={STAFF_STATUS_TONE[l.generalStatus] ?? 'neutral'}>{titleCase(l.generalStatus)}</StatusIndicator>
                        ) : <Empty />}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 hidden md:table-cell">
                        {l.employmentStatus ? (
                          <StatusIndicator tone={STAFF_EMPLOYMENT_TONE[l.employmentStatus] ?? 'neutral'}>{l.employmentStatus}</StatusIndicator>
                        ) : <Empty />}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{formatDate(p.hireDate) ?? <Empty />}</TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground hidden xl:table-cell">
                        {formatYearsOfService(p.hireDate, offboarded ? l.eocDate : null) ?? <Empty />}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{formatDate(l.eocDate) ?? <Empty />}</TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground hidden xl:table-cell max-w-[16rem] truncate" title={l.remarks ?? undefined}>
                        {l.remarks ?? <Empty />}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Link href={`/staff/${p.id}`}>
                          {canEdit ? (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 bg-info/5 hover:bg-info/10 border-info/30 text-info">
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1">
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          )}
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {!viewAll && <Pagination page={page} pageCount={pageCount} buildHref={(n) => buildParams({ page: n })} />}
    </div>
  )
}
