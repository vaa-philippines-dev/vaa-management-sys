import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  UserCog,
  Briefcase,
  Clock,
} from 'lucide-react'

const AVAILABILITY_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-500/15 text-green-700 border-green-500/20',
  PARTIALLY_ASSIGNED: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20',
  FULLY_ASSIGNED: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  ON_LEAVE: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  UNAVAILABLE: 'bg-red-500/15 text-red-700 border-red-500/20',
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

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const dept = typeof params.dept === 'string' ? params.dept : undefined
  const avail = typeof params.avail === 'string' ? params.avail : undefined
  const empStatus = typeof params.emp === 'string' ? params.emp : undefined
  const sort = typeof params.sort === 'string' ? params.sort : 'az'

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

  const [vas, departments, allVAs] = await Promise.all([
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
        assignments: {
          where: { status: 'ACTIVE' },
          include: { client: true },
        },
      },
      orderBy: { user: orderBy },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.vAProfile.count({ where: { user: { userType: 'VIRTUAL_ASSISTANT' } } }),
  ])

  const filteredVAs = empStatus
    ? vas.filter((va) => {
        const emp = va.user.employmentRecords?.[0]
        return emp?.employmentStatus === empStatus
      })
    : vas

  const activeCount = filteredVAs.filter((v) => v.isActive).length
  const availableCount = filteredVAs.filter((v) => v.availabilityStatus === 'AVAILABLE').length
  const totalAssignments = filteredVAs.reduce((s, v) => s + v.assignments.length, 0)
  const hasFilters = !!(q || dept || avail || empStatus)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">VA Roster</h2>
          <p className="text-xs text-muted-foreground">
            {hasFilters
              ? `${filteredVAs.length} of ${allVAs} VAs`
              : `${allVAs} virtual assistants`}
            {isHRE ? ' · HR view' : ' · Read-only'}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Total</span>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{filteredVAs.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Active</span>
            <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Available</span>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{availableCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Assignments</span>
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{totalAssignments}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
          <FilterBar
            filters={[
              ...(departments.length > 0
                ? [{
                    key: 'dept',
                    label: 'Department',
                    options: departments.map((d) => ({ value: d.id, label: d.name })),
                  }]
                : []),
              {
                key: 'avail',
                label: 'Availability',
                options: [
                  { value: 'AVAILABLE', label: 'Available' },
                  { value: 'PARTIALLY_ASSIGNED', label: 'Partially Assigned' },
                  { value: 'FULLY_ASSIGNED', label: 'Fully Assigned' },
                  { value: 'ON_LEAVE', label: 'On Leave' },
                  { value: 'UNAVAILABLE', label: 'Unavailable' },
                ],
              },
              {
                key: 'emp',
                label: 'Status',
                options: [
                  { value: 'EMPLOYED', label: 'Employed' },
                  { value: 'ENGAGED', label: 'Engaged' },
                  { value: 'CONTRACTED', label: 'Contracted' },
                  { value: 'END_OF_CONTRACT', label: 'End of Contract' },
                  { value: 'TRANSFERRED', label: 'Transferred' },
                  { value: 'RESIGNED', label: 'Resigned' },
                  { value: 'TERMINATED', label: 'Terminated' },
                ],
              },
              {
                key: 'sort',
                label: 'Sort',
                placeholder: 'A → Z',
                options: [
                  { value: 'az', label: 'A → Z' },
                  { value: 'za', label: 'Z → A' },
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                ],
              },
            ]}
            searchPlaceholder="Search name or email..."
          />
        </Suspense>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {filteredVAs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No VAs match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2.5 font-medium text-muted-foreground sticky left-0 bg-muted/40 z-10">Name</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden lg:table-cell">Dept / Position</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden lg:table-cell">Contract</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Availability</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden xl:table-cell">Rate</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Assignments</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground w-0"> </th>
                </tr>
              </thead>
              <tbody>
                {filteredVAs.map((va) => {
                  const emp = va.user.employmentRecords?.[0]
                  const primaryMem = va.user.memberships?.find((m) => m.isPrimary) ?? va.user.memberships?.[0]

                  return (
                    <tr key={va.id} className="border-b hover:bg-muted/30 transition-colors group">
                      <td className="p-2.5 sticky left-0 bg-card group-hover:bg-muted/30 z-10 transition-colors">
                        <Link href={`/vas/${va.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary shrink-0">
                            {(va.user.firstName || 'V')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium leading-tight">{va.user.firstName} {va.user.lastName}</p>
                            {isHRE && va.user.profile?.gender && (
                              <p className="text-[10px] text-muted-foreground leading-tight">{va.user.profile.gender}</p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="p-2.5 text-muted-foreground hidden md:table-cell">
                        <p className="leading-tight">{va.user.email}</p>
                        {isHRE && va.user.profile?.whatsappNumber && (
                          <p className="text-[10px] leading-tight">WA: {va.user.profile.whatsappNumber}</p>
                        )}
                      </td>
                      <td className="p-2.5 hidden lg:table-cell">
                        {primaryMem ? (
                          <div>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 leading-tight">{primaryMem.department.name}</Badge>
                            {primaryMem.position && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{primaryMem.position.title}</p>
                            )}
                            {va.vaaPosition && (
                              <p className="text-[10px] text-muted-foreground leading-tight">{va.vaaPosition}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2.5 hidden lg:table-cell">
                        {emp ? (
                          <div>
                            <Badge variant="outline" className={`text-[10px] py-0 px-1.5 leading-tight ${EMPLOYMENT_COLORS[emp.employmentStatus] || ''}`}>
                              {emp.contractType.replace(/_/g, ' ')}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                              {new Date(emp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 leading-tight ${AVAILABILITY_COLORS[va.availabilityStatus] || ''}`}>
                          {va.availabilityStatus.replace(/_/g, ' ')}
                        </Badge>
                        {va.hybrid && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 ml-1 bg-purple-500/15 text-purple-700 border-purple-500/20 leading-tight">Hybrid</Badge>
                        )}
                      </td>
                      <td className="p-2.5 hidden xl:table-cell">
                        {va.baseRate ? (
                          <p className="font-mono text-[10px] leading-tight">₱{Number(va.baseRate).toLocaleString()}/hr</p>
                        ) : va.hourlyRate ? (
                          <p className="font-mono text-[10px] leading-tight">${Number(va.hourlyRate).toFixed(2)}/hr</p>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {va.assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {va.assignments.slice(0, 2).map((a) => (
                              <Link key={a.id} href={`/assignments/${a.id}`}>
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 cursor-pointer hover:bg-secondary/80 max-w-[100px] truncate leading-tight">
                                  {a.client.name}
                                </Badge>
                              </Link>
                            ))}
                            {va.assignments.length > 2 && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 leading-tight">
                                +{va.assignments.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <Link href={`/vas/${va.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                            {isHRE ? 'Edit' : 'View'}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
