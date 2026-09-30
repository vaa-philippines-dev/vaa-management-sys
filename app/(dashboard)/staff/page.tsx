import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { differenceInMonths } from 'date-fns'
import { ArrowUp, ArrowDown, ArrowUpDown, Pencil, UserCog, UsersRound } from 'lucide-react'

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'
type SortField = 'name' | 'staffId' | 'department' | 'status' | 'hireDate' | 'eocDate'

const SORT_FIELDS: SortField[] = ['name', 'staffId', 'department', 'status', 'hireDate', 'eocDate']
const DEFAULT_SORT = 'hireDate:desc'
const DEFAULT_STATUS = 'ACTIVE'

// Same roles that can open /admin/users, where the linked accounts are edited.
const USER_ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'HR']
// GCash, address, birthday, emergency contact, personal email and WhatsApp.
const SENSITIVE_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'HR']

// Statuses are the sheet's own text (see StaffRecord), not GeneralStatus.
const STATUS_OPTIONS = ['ACTIVE', 'ON HOLD', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'INACTIVE']

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  'ON HOLD': 'warning',
  TRANSFERRED: 'info',
  RESIGNED: 'destructive',
  REMOVED: 'destructive',
  INACTIVE: 'neutral',
}

const EMPLOYMENT_TONE: Record<string, Tone> = {
  EMPLOYED: 'success',
  PROMOTED: 'info',
  TRANSFERRED: 'warning',
  'END OF CONTRACT': 'warning',
}

// Active, then On Hold, above every inactive status — the VA Masterlist's
// ordering when no status filter is set.
const statusTier = (status: string | null) => (status === 'ACTIVE' ? 0 : status === 'ON HOLD' ? 1 : 2)

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

function parseSort(raw: string): { field: SortField; dir: 'asc' | 'desc' } {
  const [field, dir] = raw.split(':')
  return {
    field: SORT_FIELDS.includes(field as SortField) ? (field as SortField) : 'hireDate',
    dir: dir === 'asc' ? 'asc' : 'desc',
  }
}

// Sheet dates are stored at UTC midnight (parseDmfDate) — format them in UTC
// too, or a UTC+8 server would still be right but a UTC-x one would show the
// previous day.
function formatDate(date: Date | null) {
  if (!date) return null
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatYearsOfService(hireDate: Date | null, until: Date | null): string | null {
  if (!hireDate) return null
  const months = differenceInMonths(until ?? new Date(), hireDate)
  if (months < 0) return null
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (years === 0) return `${remMonths}m`
  if (remMonths === 0) return `${years}y`
  return `${years}y ${remMonths}m`
}

const Empty = () => <span className="text-muted-foreground/50">—</span>

// The "VAA | STAFF MASTERLIST" sheet, one row per engagement (a promotion or
// transfer is a second row, same as the sheet). ~160 rows, so it loads in one
// query and sorts in memory, which keeps the Active-first ordering simple.
export default async function StaffMasterlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (currentUser.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const canEdit = USER_ADMIN_ROLES.includes(currentUser.systemRole)
  const showSensitive = SENSITIVE_VIEW_ROLES.includes(currentUser.systemRole)

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const dept = typeof params.dept === 'string' ? params.dept : undefined
  const level = typeof params.level === 'string' ? params.level : undefined
  const statusParam = typeof params.status === 'string' ? params.status : DEFAULT_STATUS
  const status = statusParam === 'ALL' ? undefined : statusParam
  const sort = typeof params.sort === 'string' ? params.sort : DEFAULT_SORT
  const { field: sortField, dir: sortDir } = parseSort(sort)

  const where: Prisma.StaffRecordWhereInput = {
    ...(status && { generalStatus: status }),
    ...(dept && { department: dept }),
    ...(level && { level }),
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { staffId: { contains: q, mode: 'insensitive' } },
        { workEmail: { contains: q, mode: 'insensitive' } },
        { position: { contains: q, mode: 'insensitive' } },
      ],
    }),
  }

  const [records, totalCount, departments, levels] = await Promise.all([
    prisma.staffRecord.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, userType: true } } },
    }),
    prisma.staffRecord.count(),
    prisma.staffRecord.findMany({ where: { department: { not: null } }, distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }),
    prisma.staffRecord.findMany({ where: { level: { not: null } }, distinct: ['level'], select: { level: true }, orderBy: { level: 'asc' } }),
  ])

  const rows = records.map((r) => ({ ...r, name: [r.firstName, r.lastName].filter(Boolean).join(' ') }))
  const mult = sortDir === 'asc' ? 1 : -1
  // Blank values sink to the bottom whichever way the column is sorted.
  const byNullable = <T,>(a: T | null, b: T | null, cmp: (x: T, y: T) => number) =>
    a == null || b == null ? (a == null ? (b == null ? 0 : 1) : -1) : cmp(a, b) * mult
  rows.sort((a, b) => {
    if (!status && sortField !== 'status') {
      const tier = statusTier(a.generalStatus) - statusTier(b.generalStatus)
      if (tier !== 0) return tier
    }
    const cmp =
      sortField === 'name' ? a.name.localeCompare(b.name) * mult :
      sortField === 'staffId' ? byNullable(a.staffId, b.staffId, (x, y) => x.localeCompare(y)) :
      sortField === 'department' ? byNullable(a.department, b.department, (x, y) => x.localeCompare(y)) :
      sortField === 'status' ? (statusTier(a.generalStatus) - statusTier(b.generalStatus) || (a.generalStatus ?? '').localeCompare(b.generalStatus ?? '')) * mult :
      sortField === 'eocDate' ? byNullable(a.eocDate, b.eocDate, (x, y) => x.getTime() - y.getTime()) :
      byNullable(a.hireDate, b.hireDate, (x, y) => x.getTime() - y.getTime())
    return cmp || a.name.localeCompare(b.name)
  })

  const activeCount = rows.filter((r) => r.generalStatus === 'ACTIVE').length
  const hasFilters = !!(q || dept || level || statusParam !== DEFAULT_STATUS)

  const buildSortHref = (field: SortField) => {
    const dateField = field === 'hireDate' || field === 'eocDate'
    const nextDir = sortField === field ? (sortDir === 'desc' ? 'asc' : 'desc') : dateField ? 'desc' : 'asc'
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (dept) sp.set('dept', dept)
    if (level) sp.set('level', level)
    sp.set('status', statusParam)
    sp.set('sort', `${field}:${nextDir}`)
    return `?${sp.toString()}`
  }

  // `inverted` is for Yrs, which reuses the Hire Date sort with the arrow flipped.
  const sortIcon = (field: SortField, inverted = false) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
    return (sortDir === 'asc') !== inverted ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  const sortHead = (field: SortField, label: string, { className = '', inverted = false } = {}) => (
    <TableHead className={`px-3 py-2.5 whitespace-nowrap ${className}`}>
      <Link href={buildSortHref(field)} className="flex items-center gap-1 hover:text-foreground">
        {label} {sortIcon(field, inverted)}
      </Link>
    </TableHead>
  )
  const head = (label: string) => <TableHead className="px-3 py-2.5 whitespace-nowrap">{label}</TableHead>

  return (
    <div data-wide-page className="space-y-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Staff Masterlist</h2>
        <p className="text-xs text-muted-foreground">Internal staff, one row per engagement — imported from the VAA Staff Masterlist sheet</p>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <FilterBar
          filters={[
            {
              key: 'status',
              label: 'Status',
              defaultValue: DEFAULT_STATUS,
              options: [
                { value: 'ALL', label: 'All Statuses' },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: titleCase(s) })),
              ],
            },
            {
              key: 'dept',
              label: 'Dept',
              options: departments.map((d) => ({ value: d.department!, label: d.department! })),
            },
            {
              key: 'level',
              label: 'Level',
              options: levels.map((l) => ({ value: l.level!, label: l.level! })),
            },
          ]}
          searchPlaceholder="Search name, staff ID, email, or position..."
        />
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <UsersRound className="h-3 w-3" />
          {hasFilters ? `${rows.length} / ${totalCount}` : totalCount} records
        </span>
        <span className="flex items-center gap-1.5">
          <UserCog className="h-3 w-3" />
          {activeCount} active
        </span>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <UsersRound className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {totalCount === 0 ? 'No staff records yet — the Staff Masterlist sheet hasn’t been imported' : 'No staff match your filters'}
            </p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-17rem)] overflow-auto">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="bg-muted/30">
                  {sortHead('name', 'Name', { className: 'sticky left-0 bg-muted/30 z-10' })}
                  {sortHead('staffId', 'Staff ID')}
                  {sortHead('department', 'Department')}
                  {head('Position')}
                  {head('Level')}
                  {head('Work Email')}
                  {sortHead('status', 'Status')}
                  {head('Employment Status')}
                  {sortHead('hireDate', 'Hire Date')}
                  {head('Start Date')}
                  {sortHead('hireDate', 'Yrs', { inverted: true })}
                  {sortHead('eocDate', 'EOC Date')}
                  {showSensitive && (
                    <>
                      {head('Personal Email')}
                      {head('WhatsApp')}
                      {head('GCash')}
                      {head('Birthday')}
                      {head('Emergency Contact')}
                      {head('Address')}
                    </>
                  )}
                  {head('Remarks')}
                  {canEdit && <TableHead className="px-3 py-2.5 w-0"> </TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} className="hover:bg-accent/50 group">
                    <TableCell className="px-3 py-2.5 sticky left-0 bg-card group-hover:bg-accent/50 z-10 transition-colors">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary shrink-0">
                          {(s.firstName || 'S')[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{s.name}</span>
                        {/* Team Leaders keep their VA account and also appear here. */}
                        {s.user?.userType === 'VIRTUAL_ASSISTANT' && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1">VA</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{s.staffId ?? <Empty />}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap">
                      {s.department ? (
                        <span className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">{s.department}</Badge>
                          {s.subdepartment && s.subdepartment !== s.department && (
                            <span className="text-[10px] text-muted-foreground">{s.subdepartment}</span>
                          )}
                        </span>
                      ) : <Empty />}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap">{s.position ?? <Empty />}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{s.level ?? <Empty />}</TableCell>
                    <TableCell className="px-3 py-2.5 text-muted-foreground">{s.workEmail ?? <Empty />}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap">
                      {s.generalStatus ? (
                        <StatusIndicator tone={STATUS_TONE[s.generalStatus] ?? 'neutral'}>{titleCase(s.generalStatus)}</StatusIndicator>
                      ) : <Empty />}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap">
                      {s.employmentStatus ? (
                        <StatusIndicator tone={EMPLOYMENT_TONE[s.employmentStatus] ?? 'neutral'}>{s.employmentStatus}</StatusIndicator>
                      ) : <Empty />}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(s.hireDate) ?? <Empty />}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(s.startDate) ?? <Empty />}</TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatYearsOfService(s.hireDate, s.generalStatus === 'ACTIVE' ? null : s.eocDate) ?? <Empty />}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(s.eocDate) ?? <Empty />}</TableCell>
                    {showSensitive && (
                      <>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">{s.personalEmail ?? <Empty />}</TableCell>
                        <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{s.whatsapp ?? <Empty />}</TableCell>
                        <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{s.gcash ?? <Empty />}</TableCell>
                        <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(s.birthDate) ?? <Empty />}</TableCell>
                        <TableCell className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{s.emergencyContact ?? <Empty />}</TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground max-w-[18rem] truncate" title={s.address ?? undefined}>{s.address ?? <Empty />}</TableCell>
                      </>
                    )}
                    <TableCell className="px-3 py-2.5 text-muted-foreground max-w-[14rem] truncate" title={s.remarks ?? undefined}>{s.remarks ?? <Empty />}</TableCell>
                    {canEdit && (
                      <TableCell className="px-3 py-2.5">
                        {s.user && (
                          <Link href={`/admin/users?q=${encodeURIComponent(s.user.firstName)}`}>
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 bg-info/5 hover:bg-info/10 border-info/30 text-info">
                              <Pencil className="h-3 w-3" />
                              Account
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
