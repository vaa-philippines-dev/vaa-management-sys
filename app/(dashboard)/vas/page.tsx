import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { QuickAddVABtn } from '@/components/vas/QuickAddVABtn'
import {
  Users,
  UserCog,
  Briefcase,
  Clock,
  Pencil,
  Eye,
} from 'lucide-react'

const AVAILABILITY_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-500/15 text-green-700 border-green-500/20',
  PARTIALLY_ASSIGNED: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20',
  FULLY_ASSIGNED: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  ON_LEAVE: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  UNAVAILABLE: 'bg-red-500/15 text-red-700 border-red-500/20',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/15 text-green-700 border-green-500/20',
  ON_HOLD: 'bg-amber-500/15 text-amber-700 border-amber-500/20',
  INACTIVE: 'bg-red-500/15 text-red-600 border-red-500/20',
}

const EMPLOYMENT_COLORS: Record<string, string> = {
  EMPLOYED: 'bg-green-500/15 text-green-700 border-green-500/20',
  ENGAGED: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  CONTRACTED: 'bg-purple-500/15 text-purple-700 border-purple-500/20',
  END_OF_CONTRACT: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  TRANSFERRED: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20',
  RESIGNED: 'bg-red-500/15 text-red-700 border-red-500/20',
  TERMINATED: 'bg-red-500/15 text-red-700 border-red-500/20',
  BLACKLISTED: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
}

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'EXECUTIVE']

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
  const sort = typeof params.sort === 'string' ? params.sort : 'az'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight">VA Roster</h2>
          {isHRE && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-blue-500/10 text-blue-700 border-blue-500/20">HR View</Badge>
          )}
        </div>
        {isAdmin && <QuickAddVABtn />}
      </div>

      <div className="rounded-xl border bg-card p-2.5">
        <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
          <FilterWrapper />
        </Suspense>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <VATableSection q={q} dept={dept} avail={avail} empStatus={empStatus} sort={sort} isHRE={isHRE} />
      </Suspense>
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
        {
          key: 'sort',
          label: 'Sort',
          placeholder: 'A→Z',
          options: [
            { value: 'az', label: 'A → Z' },
            { value: 'za', label: 'Z → A' },
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
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
}: {
  q?: string
  dept?: string
  avail?: string
  empStatus?: string
  sort: string
  isHRE: boolean
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

  const vaWhere: Record<string, unknown> = {}
  if (avail) vaWhere.availabilityStatus = avail

  const orderBy: Record<string, string> =
    sort === 'za' ? { firstName: 'desc' } :
    sort === 'newest' ? { createdAt: 'desc' } :
    sort === 'oldest' ? { createdAt: 'asc' } :
    { firstName: 'asc' }

  const [vas, allVAs] = await Promise.all([
    cached('vas:list', [CACHE_TAGS.vas], 60, () =>
      prisma.vAProfile.findMany({
        where: {
          user: { userType: 'VIRTUAL_ASSISTANT', ...userWhere },
          ...vaWhere,
        },
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
          vaSkills: { include: { skill: true } },
          assignments: { where: { status: 'ACTIVE' }, include: { client: true } },
        },
        orderBy: { user: orderBy },
      })
    ),
    cached('vas:count', [CACHE_TAGS.vas], 60, () =>
      prisma.vAProfile.count({ where: { user: { userType: 'VIRTUAL_ASSISTANT' } } })
    ),
  ])

  const filteredVAs = empStatus
    ? vas.filter((va) => {
        const emp = va.user.employmentRecords?.[0]
        return emp?.employmentStatus === empStatus
      })
    : vas

  const activeCount = filteredVAs.filter((v) => v.status === 'ACTIVE').length
  const availableCount = filteredVAs.filter((v) => v.availabilityStatus === 'AVAILABLE').length
  const hasFilters = !!(q || dept || avail || empStatus)

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-muted/30 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          {hasFilters ? `${filteredVAs.length} / ${allVAs}` : allVAs} VAs
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

      <div className="rounded-xl border bg-card overflow-hidden">
        {filteredVAs.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No VAs match your filters</p>
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="px-3 py-2.5 sticky left-0 bg-muted/30 z-10">Name</TableHead>
                <TableHead className="px-3 py-2.5 hidden md:table-cell">Email</TableHead>
                <TableHead className="px-3 py-2.5 hidden lg:table-cell">Department</TableHead>
                <TableHead className="px-3 py-2.5 hidden lg:table-cell">Position</TableHead>
                <TableHead className="px-3 py-2.5 hidden sm:table-cell">Availability</TableHead>
                <TableHead className="px-3 py-2.5 hidden sm:table-cell">Status</TableHead>
                <TableHead className="px-3 py-2.5 hidden md:table-cell">Eng. Status</TableHead>
                <TableHead className="px-3 py-2.5 w-0"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVAs.map((va) => {
                const emp = va.user.employmentRecords?.[0]
                const primaryMem = va.user.memberships?.find((m) => m.isPrimary) ?? va.user.memberships?.[0]

                return (
                  <TableRow key={va.id} className="hover:bg-primary/5 group">
                    <TableCell className="px-3 py-2.5 sticky left-0 bg-card group-hover:bg-primary/5 z-10 transition-colors">
                      <Link href={`/vas/${va.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary shrink-0">
                          {(va.user.firstName || 'V')[0].toUpperCase()}
                        </div>
                        <span className="font-medium">
                          {va.user.firstName} {va.user.lastName}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{va.user.email}</TableCell>
                    <TableCell className="px-3 py-2.5 hidden lg:table-cell">
                      {primaryMem?.department ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">{primaryMem.department.name}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 hidden lg:table-cell">
                      {primaryMem?.position ? primaryMem.position.title : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 hidden sm:table-cell">
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${AVAILABILITY_COLORS[va.availabilityStatus] || ''}`}>
                        {va.availabilityStatus.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 hidden sm:table-cell">
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${STATUS_COLORS[va.status] || STATUS_COLORS.INACTIVE}`}>
                        {va.status === 'ACTIVE' ? 'Active' : va.status === 'ON_HOLD' ? 'On Hold' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 hidden md:table-cell">
                      {emp ? (
                        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${EMPLOYMENT_COLORS[emp.employmentStatus] || ''}`}>
                          {emp.employmentStatus.replace(/_/g, ' ')}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Link href={`/vas/${va.id}`}>
                        {isHRE ? (
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 bg-blue-500/5 hover:bg-blue-500/10 border-blue-200 text-blue-700">
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
    </>
  )
}

function TableSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-muted/30">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
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
