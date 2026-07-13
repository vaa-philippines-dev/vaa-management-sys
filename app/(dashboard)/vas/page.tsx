import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { QuickAddVABtn } from '@/components/vas/QuickAddVABtn'
import { VABulkSelectToggle } from '@/components/vas/VABulkSelectToggle'
import { VARowCheckbox } from '@/components/vas/VARowCheckbox'
import { VASelectAllCheckbox } from '@/components/vas/VASelectAllCheckbox'
import { Pagination } from '@/components/ui/pagination'
import {
  Users,
  UserCog,
  Briefcase,
  Clock,
  Pencil,
  Eye,
  LayoutList,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'

const PAGE_SIZE = 20

type SortField = 'name' | 'position' | 'status' | 'engagement' | 'hireDate' | 'eocDate'
const DEFAULT_SORT: `${SortField}:${'asc' | 'desc'}` = 'hireDate:desc'
const SORT_FIELDS: SortField[] = ['name', 'position', 'status', 'engagement', 'hireDate', 'eocDate']

function parseSort(raw: string | undefined): { field: SortField; dir: 'asc' | 'desc' } {
  const [field, dir] = (raw || DEFAULT_SORT).split(':')
  return {
    field: SORT_FIELDS.includes(field as SortField) ? (field as SortField) : 'hireDate',
    dir: dir === 'asc' ? 'asc' : 'desc',
  }
}

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  TRANSFERRED: 'info',
  RESIGNED: 'destructive',
  REMOVED: 'destructive',
  PROJECT_ENDED: 'neutral',
  CANCELLED: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  TRANSFERRED: 'Transferred',
  RESIGNED: 'Resigned',
  REMOVED: 'Removed',
  PROJECT_ENDED: 'Project Ended',
  CANCELLED: 'Cancelled',
}

const EMPLOYMENT_TONE: Record<string, Tone> = {
  EMPLOYED: 'success',
  ENGAGED: 'info',
  CONTRACTED: 'info',
  END_OF_CONTRACT: 'warning',
  TRANSFERRED: 'warning',
  RESIGNED: 'destructive',
  TERMINATED: 'destructive',
  BLACKLISTED: 'neutral',
}

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'EXECUTIVE']

export default async function VAPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  const isHRE = currentUser ? hrgRoles.includes(currentUser.systemRole) : false
  const isAdmin = currentUser ? canMutate(currentUser) : false

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const dept = typeof params.dept === 'string' ? params.dept : undefined
  const avail = typeof params.avail === 'string' ? params.avail : undefined
  const empStatus = typeof params.emp === 'string' ? params.emp : undefined
  const sort = typeof params.sort === 'string' ? params.sort : DEFAULT_SORT
  const viewAll = params.view === 'all'
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const tableSection = (
    <Suspense key={`${q}-${dept}-${avail}-${empStatus}-${sort}-${viewAll}-${page}`} fallback={<TableSkeleton />}>
      <VATableSection q={q} dept={dept} avail={avail} empStatus={empStatus} sort={sort} isHRE={isHRE} isAdmin={isAdmin} viewAll={viewAll} page={page} />
    </Suspense>
  )

  return (
    <div className="space-y-3">
      {isAdmin ? (
        <VABulkSelectToggle
          headerActions={
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight">VA Roster</h2>
              {isHRE && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-info/10 text-info border-info/20">HR View</Badge>
              )}
            </div>
          }
          extraActions={<QuickAddVABtn />}
        >
          <div className="rounded-lg border bg-card p-2.5">
            <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
              <FilterWrapper />
            </Suspense>
          </div>
          {tableSection}
        </VABulkSelectToggle>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight">VA Roster</h2>
              {isHRE && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-info/10 text-info border-info/20">HR View</Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-2.5">
            <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
              <FilterWrapper />
            </Suspense>
          </div>

          {tableSection}
        </>
      )}
    </div>
  )
}

async function FilterWrapper() {
  const departments = await cached('vas:departments', [CACHE_TAGS.departments], 600, () =>
    prisma.department.findMany({ where: { status: 'ACTIVE', parentId: { not: null } }, orderBy: { sortOrder: 'asc' } })
  )

  return (
    <FilterBar
      filters={[
        ...(departments.length > 0
          ? [{ key: 'dept', label: 'Dept', options: departments.map((d) => ({ value: d.id, label: d.name })) }]
          : []),
        {
          key: 'avail',
          label: 'Avail',
          options: [
            { value: 'AVAILABLE', label: 'Available' },
            { value: 'PARTIALLY_ASSIGNED', label: 'Partially' },
            { value: 'FULLY_ASSIGNED', label: 'Fully' },
            { value: 'ON_LEAVE', label: 'Leave' },
            { value: 'UNAVAILABLE', label: 'Unavailable' },
          ],
        },
        {
          key: 'emp',
          label: 'Eng',
          options: [
            { value: 'EMPLOYED', label: 'Employed' },
            { value: 'ENGAGED', label: 'Engaged' },
            { value: 'CONTRACTED', label: 'Contracted' },
            { value: 'END_OF_CONTRACT', label: 'Ended' },
            { value: 'TRANSFERRED', label: 'Transferred' },
            { value: 'RESIGNED', label: 'Resigned' },
            { value: 'TERMINATED', label: 'Terminated' },
          ],
        },
      ]}
      searchPlaceholder="Search name or email..."
    />
  )
}

async function VATableSection({
  q,
  dept,
  avail,
  empStatus,
  sort,
  isHRE,
  isAdmin,
  viewAll,
  page,
}: {
  q?: string
  dept?: string
  avail?: string
  empStatus?: string
  sort: string
  isHRE: boolean
  isAdmin: boolean
  viewAll: boolean
  page: number
}) {
  const userWhere: Record<string, unknown> = {}
  if (q) {
    userWhere.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (dept) {
    userWhere.memberships = { some: { departmentId: dept, endedAt: null } }
  }
  if (empStatus) {
    userWhere.employmentRecords = { some: { isCurrent: true, employmentStatus: empStatus } }
  }

  const vaWhere: Record<string, unknown> = {}
  if (avail) vaWhere.availabilityStatus = avail

  const { field: sortField, dir: sortDir } = parseSort(sort)

  const orderBy: Prisma.VAProfileOrderByWithRelationInput =
    sortField === 'name' ? { user: { firstName: sortDir } } :
    sortField === 'position' ? { positionSkill: { shortName: sortDir } } :
    sortField === 'status' ? { status: sortDir } :
    sortField === 'engagement' ? { engagementStatus: sortDir } :
    sortField === 'eocDate' ? { currentEndDate: sortDir } :
    { currentHireDate: sortDir }

  const where: Prisma.VAProfileWhereInput = {
    user: { userType: 'VIRTUAL_ASSISTANT', ...userWhere },
    ...vaWhere,
  }

  const cacheKey = `vas:list:${JSON.stringify({ q, dept, avail, empStatus, sort, viewAll, page })}`

  const [filteredVAs, filteredCount, allVAs] = await Promise.all([
    cached(cacheKey, [CACHE_TAGS.vas], 60, () =>
      prisma.vAProfile.findMany({
        where,
        include: {
          user: {
            include: {
              profile: true,
              memberships: {
                where: { endedAt: null },
                include: { department: true, position: true },
              },
              employmentRecords: { where: { isCurrent: true }, take: 1 },
            },
          },
          positionSkill: true,
          vaSkills: { include: { skill: true } },
          assignments: { where: { status: 'ACTIVE' }, include: { client: true } },
        },
        orderBy,
        ...(viewAll ? {} : { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
      })
    ),
    cached(`vas:count:${JSON.stringify({ q, dept, avail, empStatus })}`, [CACHE_TAGS.vas], 60, () =>
      prisma.vAProfile.count({ where })
    ),
    cached('vas:count:all', [CACHE_TAGS.vas], 60, () =>
      prisma.vAProfile.count({ where: { user: { userType: 'VIRTUAL_ASSISTANT' } } })
    ),
  ])

  const activeCount = filteredVAs.filter((v) => v.status === 'ACTIVE').length
  const availableCount = filteredVAs.filter((v) => v.availabilityStatus === 'AVAILABLE').length
  const hasFilters = !!(q || dept || avail || empStatus)
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  const buildHref = (targetPage: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (dept) sp.set('dept', dept)
    if (avail) sp.set('avail', avail)
    if (empStatus) sp.set('emp', empStatus)
    if (sort) sp.set('sort', sort)
    if (targetPage > 1) sp.set('page', String(targetPage))
    return `?${sp.toString()}`
  }

  const viewAllHref = (() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (dept) sp.set('dept', dept)
    if (avail) sp.set('avail', avail)
    if (empStatus) sp.set('emp', empStatus)
    if (sort) sp.set('sort', sort)
    sp.set('view', 'all')
    return `?${sp.toString()}`
  })()

  const paginatedHref = (() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (dept) sp.set('dept', dept)
    if (avail) sp.set('avail', avail)
    if (empStatus) sp.set('emp', empStatus)
    if (sort) sp.set('sort', sort)
    return `?${sp.toString()}`
  })()

  const buildSortHref = (field: SortField) => {
    const nextDir = sortField === field && sortDir === 'desc' ? 'asc' : sortField === field ? 'desc' : (field === 'hireDate' || field === 'eocDate' ? 'desc' : 'asc')
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (dept) sp.set('dept', dept)
    if (avail) sp.set('avail', avail)
    if (empStatus) sp.set('emp', empStatus)
    sp.set('sort', `${field}:${nextDir}`)
    if (viewAll) sp.set('view', 'all')
    return `?${sp.toString()}`
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {hasFilters ? `${filteredCount} / ${allVAs}` : allVAs} VAs
          </span>
          <span className="flex items-center gap-1.5">
            <UserCog className="h-3 w-3" />
            {activeCount} active
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {availableCount} available
          </span>
        </div>
        {viewAll ? (
          <Link href={paginatedHref} className="flex items-center gap-1.5 font-medium text-primary hover:underline">
            <LayoutList className="h-3 w-3" />
            Paginate ({PAGE_SIZE}/page)
          </Link>
        ) : (
          filteredCount > PAGE_SIZE && (
            <Link href={viewAllHref} className="flex items-center gap-1.5 font-medium text-primary hover:underline">
              <LayoutList className="h-3 w-3" />
              View All
            </Link>
          )
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {filteredVAs.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No VAs match your filters</p>
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/30">
                {isAdmin && (
                  <TableHead className="px-3 py-2.5 w-0">
                    <VASelectAllCheckbox ids={filteredVAs.map((va) => va.id)} />
                  </TableHead>
                )}
                <TableHead className="px-3 py-2.5 sticky left-0 bg-muted/30 z-10">
                  <Link href={buildSortHref('name')} className="flex items-center gap-1 hover:text-foreground">
                    Name {sortIcon('name')}
                  </Link>
                </TableHead>
                <TableHead className="px-3 py-2.5 hidden md:table-cell">Work Email</TableHead>
                <TableHead className="px-3 py-2.5 hidden lg:table-cell">Department</TableHead>
                <TableHead className="px-3 py-2.5 hidden lg:table-cell">
                  <Link href={buildSortHref('position')} className="flex items-center gap-1 hover:text-foreground">
                    Position {sortIcon('position')}
                  </Link>
                </TableHead>
                <TableHead className="px-3 py-2.5 hidden sm:table-cell">
                  <Link href={buildSortHref('status')} className="flex items-center gap-1 hover:text-foreground">
                    Status {sortIcon('status')}
                  </Link>
                </TableHead>
                <TableHead className="px-3 py-2.5 hidden md:table-cell">
                  <Link href={buildSortHref('engagement')} className="flex items-center gap-1 hover:text-foreground">
                    Engagement Status {sortIcon('engagement')}
                  </Link>
                </TableHead>
                <TableHead className="px-3 py-2.5 hidden md:table-cell">
                  <Link href={buildSortHref('hireDate')} className="flex items-center gap-1 hover:text-foreground">
                    Hire Date {sortIcon('hireDate')}
                  </Link>
                </TableHead>
                <TableHead className="px-3 py-2.5 hidden md:table-cell">
                  <Link href={buildSortHref('eocDate')} className="flex items-center gap-1 hover:text-foreground">
                    EOC/Transfer Date {sortIcon('eocDate')}
                  </Link>
                </TableHead>
                <TableHead className="px-3 py-2.5 w-0"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVAs.map((va) => {
                const emp = va.user.employmentRecords?.[0]
                const primaryMem = va.user.memberships?.find((m) => m.isPrimary) ?? va.user.memberships?.[0]

                return (
                  <TableRow key={va.id} className="hover:bg-accent/50 group">
                    {isAdmin && (
                      <TableCell className="px-3 py-2.5">
                        <VARowCheckbox id={va.id} />
                      </TableCell>
                    )}
                    <TableCell className="px-3 py-2.5 sticky left-0 bg-card group-hover:bg-accent/50 z-10 transition-colors">
                      <Link href={`/vas/${va.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary shrink-0">
                          {(va.user.firstName || 'V')[0].toUpperCase()}
                        </div>
                        <span className="font-medium">
                          {va.user.firstName} {va.user.lastName}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{va.user.profile?.workEmail || <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="px-3 py-2.5 hidden lg:table-cell">
                      {primaryMem?.department ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">{primaryMem.department.name}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 hidden lg:table-cell">
                      {va.positionSkill?.shortName ?? va.vaaPosition ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <StatusIndicator tone={STATUS_TONE[va.status] ?? 'neutral'}>
                          {STATUS_LABEL[va.status] ?? va.status}
                        </StatusIndicator>
                        {va.onHold && <StatusIndicator tone="warning">On Hold</StatusIndicator>}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 hidden md:table-cell">
                      {emp ? (
                        <StatusIndicator tone={EMPLOYMENT_TONE[emp.employmentStatus] ?? 'neutral'}>
                          {emp.employmentStatus.replace(/_/g, ' ')}
                        </StatusIndicator>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                      {va.currentHireDate ? formatDate(va.currentHireDate) : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                      {va.currentEndDate ? formatDate(va.currentEndDate) : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Link href={`/vas/${va.id}`}>
                        {isHRE ? (
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
        )}
      </div>

      {!viewAll && (
        <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
      )}
    </>
  )
}

function TableSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/30">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-2 space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-40 hidden md:block" />
              <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
