import { getStaffPeople, hiredBeforeStaff, type StaffPerson } from '@/lib/staff'
import {
  STAFF_STATUS_OPTIONS,
  STAFF_EMPLOYMENT_OPTIONS,
  STAFF_STATUS_TONE,
  STAFF_EMPLOYMENT_TONE,
  STAFF_GROUP_HEADS,
  staffStatusTier,
  staffGroupOf,
  compareStaffGroups,
  titleCase,
  type StaffGroup,
} from '@/lib/staff-fields'
import Link from 'next/link'
import { Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Pagination } from '@/components/ui/pagination'
import { AddStaffBtn } from '@/components/staff/AddStaffBtn'
import { differenceInMonths } from 'date-fns'
import { ArrowUp, ArrowDown, ArrowUpDown, Eye, LayoutList, Pencil, UserCog, Users } from 'lucide-react'

const PAGE_SIZE = 20
const COLUMN_COUNT = 11

// `hireDate` sorts by the staff hire date (StaffPerson.staffHireDate).
type SortField = 'name' | 'position' | 'status' | 'employment' | 'hireDate' | 'eocDate'
const SORT_FIELDS: SortField[] = ['name', 'position', 'status', 'employment', 'hireDate', 'eocDate']
const DEFAULT_STATUS = 'ACTIVE'

// URL params the Staff table owns on /masterlist. Prefixed with `s` so they
// never collide with the VA table's unprefixed q/status/dept/sort/page.
export const STAFF_PARAM_KEYS = ['sq', 'sstatus', 'sdept', 'slevel', 'semp', 'ssort', 'sview', 'spage']

// No sort param = department order (staffGroupOf); a column sort then orders
// people within each department section.
function parseSort(raw: string | undefined): { field: SortField; dir: 'asc' | 'desc' } | null {
  if (!raw) return null
  const [field, dir] = raw.split(':')
  if (!SORT_FIELDS.includes(field as SortField)) return null
  return { field: field as SortField, dir: dir === 'asc' ? 'asc' : 'desc' }
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

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

const Empty = () => <span className="text-muted-foreground/50">—</span>

// The Masterlist's Staff table: one row per person (their latest engagement),
// opening the Staff 201 at /staff/[id], sectioned by department. ~150 people,
// so it loads once and filters/sorts/pages in memory. `keep` is the VA
// table's query string, carried through this table's links.
export async function StaffSection({
  canEdit,
  params,
  keep,
}: {
  canEdit: boolean
  params: Record<string, string | string[] | undefined>
  keep: string
}) {
  const q = typeof params.sq === 'string' ? params.sq.trim().toLowerCase() : ''
  const dept = typeof params.sdept === 'string' ? params.sdept : undefined
  const level = typeof params.slevel === 'string' ? params.slevel : undefined
  const emp = typeof params.semp === 'string' ? params.semp : undefined
  const statusParam = typeof params.sstatus === 'string' ? params.sstatus : DEFAULT_STATUS
  const status = statusParam === 'ALL' ? undefined : statusParam
  const sort = typeof params.ssort === 'string' ? params.ssort : undefined
  const viewAll = params.sview === 'all'
  const page = Math.max(1, parseInt(typeof params.spage === 'string' ? params.spage : '1', 10) || 1)
  const parsedSort = parseSort(sort)
  const sortField = parsedSort?.field ?? null
  const sortDir = parsedSort?.dir ?? 'desc'

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
  const groups = new Map<string, StaffGroup>(filtered.map((p) => [p.id, staffGroupOf(p.latest.department, p.latest.subdepartment)]))
  const group = (p: StaffPerson) => groups.get(p.id)!
  const isHead = (p: StaffPerson) => STAFF_GROUP_HEADS[group(p).label] === normName(p.name)

  const mult = sortDir === 'asc' ? 1 : -1
  // Blank values sink to the bottom whichever way the column is sorted.
  const nullsLast = <T,>(a: T | null, b: T | null, cmp: (x: T, y: T) => number) =>
    a == null || b == null ? (a == null ? (b == null ? 0 : 1) : -1) : cmp(a, b)
  const byNullable = <T,>(a: T | null, b: T | null, cmp: (x: T, y: T) => number) => nullsLast(a, b, (x, y) => cmp(x, y) * mult)
  const str = (x: string, y: string) => x.localeCompare(y)
  const time = (x: Date, y: Date) => x.getTime() - y.getTime()
  filtered.sort((a, b) => {
    const section = compareStaffGroups(group(a), group(b))
    if (section !== 0) return section
    if (!status && sortField !== 'status') {
      const tier = staffStatusTier(a.latest.generalStatus) - staffStatusTier(b.latest.generalStatus)
      if (tier !== 0) return tier
    }
    const cmp =
      // Department order: leadership sections follow the HR sheet's rows
      // (section head first); every other section lists recent hires first.
      sortField === null ? (
        Number(isHead(b)) - Number(isHead(a)) ||
        (group(a).order === 'sheet'
          ? nullsLast(a.latest.sheetRow, b.latest.sheetRow, (x, y) => x - y) || nullsLast(a.staffHireDate, b.staffHireDate, time)
          : nullsLast(a.staffHireDate, b.staffHireDate, (x, y) => time(y, x)))
      ) :
      sortField === 'name' ? a.name.localeCompare(b.name) * mult :
      sortField === 'position' ? byNullable(a.latest.position, b.latest.position, str) :
      sortField === 'status' ? (staffStatusTier(a.latest.generalStatus) - staffStatusTier(b.latest.generalStatus) || (a.latest.generalStatus ?? '').localeCompare(b.latest.generalStatus ?? '')) * mult :
      sortField === 'employment' ? byNullable(a.latest.employmentStatus, b.latest.employmentStatus, str) :
      sortField === 'eocDate' ? byNullable(a.latest.eocDate, b.latest.eocDate, time) :
      byNullable(a.staffHireDate, b.staffHireDate, time)
    return cmp || a.name.localeCompare(b.name)
  })

  // Section sizes for the header rows — across every page, not just this one.
  const sectionCounts = new Map<string, number>()
  for (const p of filtered) sectionCounts.set(group(p).key, (sectionCounts.get(group(p).key) ?? 0) + 1)

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = viewAll ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = !!(q || dept || level || emp || statusParam !== DEFAULT_STATUS)

  type ParamsState = { q?: string; dept?: string; level?: string; emp?: string; status?: string; sort?: string; viewAll?: boolean; page?: number }
  const base: ParamsState = { q, dept, level, emp, status: statusParam, sort, viewAll, page }
  const buildParams = (overrides: Partial<ParamsState>) => {
    const m = { ...base, ...overrides }
    const sp = new URLSearchParams(keep)
    if (m.q) sp.set('sq', m.q)
    if (m.dept) sp.set('sdept', m.dept)
    if (m.level) sp.set('slevel', m.level)
    if (m.emp) sp.set('semp', m.emp)
    sp.set('sstatus', m.status ?? DEFAULT_STATUS)
    if (m.sort) sp.set('ssort', m.sort)
    if (m.viewAll) sp.set('sview', 'all')
    if (m.page && m.page > 1) sp.set('spage', String(m.page))
    return `?${sp.toString()}#staff`
  }
  const buildSortHref = (field: SortField) => {
    const dateField = field === 'hireDate' || field === 'eocDate'
    const nextDir = sortField === field ? (sortDir === 'desc' ? 'asc' : 'desc') : dateField ? 'desc' : 'asc'
    return buildParams({ sort: `${field}:${nextDir}`, page: undefined })
  }
  // `inverted` is for Yrs, which reuses the Staff Hire Date sort with the arrow flipped.
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
    <section id="staff" className="space-y-3 scroll-mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight">Staff</h2>
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
              key: 'sstatus',
              label: 'Status',
              defaultValue: DEFAULT_STATUS,
              options: [{ value: 'ALL', label: 'All Statuses' }, ...STAFF_STATUS_OPTIONS.map((s) => ({ value: s, label: titleCase(s) }))],
            },
            { key: 'sdept', label: 'Dept', options: departments.map((d) => ({ value: d, label: d })) },
            { key: 'slevel', label: 'Level', options: levels.map((l) => ({ value: l, label: l })) },
            { key: 'semp', label: 'Emp', options: STAFF_EMPLOYMENT_OPTIONS.map((e) => ({ value: e, label: titleCase(e) })) },
          ]}
          searchPlaceholder="Search name, staff ID, email, or position..."
          searchKey="sq"
          paramKeys={STAFF_PARAM_KEYS}
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
          {sortField !== null && (
            <Link href={buildParams({ sort: undefined, page: undefined })} className="font-medium text-primary hover:underline">
              Department order
            </Link>
          )}
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
                  {sortHead('hireDate', 'Staff Hire Date', 'hidden md:table-cell')}
                  {sortHead('hireDate', 'Yrs', 'hidden xl:table-cell', true)}
                  {sortHead('eocDate', 'EOC Date', 'hidden md:table-cell')}
                  <TableHead className="px-3 py-2.5 hidden xl:table-cell">Remarks</TableHead>
                  <TableHead className="px-3 py-2.5 w-0"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p, i) => {
                  const l = p.latest
                  const offboarded = l.generalStatus !== 'ACTIVE' && l.generalStatus !== 'ON HOLD'
                  const section = group(p)
                  const startsSection = i === 0 || group(rows[i - 1]).key !== section.key
                  return (
                    <Fragment key={p.id}>
                      {startsSection && (
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={COLUMN_COUNT} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span className="sticky left-3">
                              {section.label} <span className="font-normal">· {sectionCounts.get(section.key)}</span>
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow className="hover:bg-accent/50 group">
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
                        <TableCell className="px-3 py-2.5 hidden lg:table-cell">
                          {l.position || l.level ? (
                            <span className="flex items-center gap-1">
                              {l.position ?? <Empty />}
                              {l.level && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{l.level}</Badge>}
                            </span>
                          ) : <Empty />}
                        </TableCell>
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
                        <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                          {formatDate(p.staffHireDate) ?? <Empty />}
                          {/* Upskilled from VA: their VAA hire date predates joining staff. */}
                          {hiredBeforeStaff(p) && (
                            <div className="text-[10px] text-muted-foreground/70 whitespace-nowrap">VAA hire {formatDate(p.vaaHireDate)}</div>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground hidden xl:table-cell">
                          {formatYearsOfService(p.staffHireDate, offboarded ? l.eocDate : null) ?? <Empty />}
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
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {!viewAll && <Pagination page={page} pageCount={pageCount} buildHref={(n) => buildParams({ page: n })} />}
    </section>
  )
}
