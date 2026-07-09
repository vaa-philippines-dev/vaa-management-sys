import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { Users, LayoutList } from 'lucide-react'
import { redirect } from 'next/navigation'
import { UserCard } from '@/components/admin/UserCard'
import { AddUserPanel } from '@/components/admin/AddUserPanel'
import { FilterBar } from '@/components/filters/FilterBar'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import Link from 'next/link'

const PAGE_SIZE = 20

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE'].includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }
  const canEdit = canMutate(currentUser)

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const role = typeof params.role === 'string' ? params.role : undefined
  const type = typeof params.type === 'string' ? params.type : undefined
  const dept = typeof params.dept === 'string' ? params.dept : undefined
  const sort = typeof params.sort === 'string' ? params.sort : 'newest'
  const viewAll = params.view === 'all'
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const orderBy: Record<string, string> =
    sort === 'az' ? { firstName: 'asc' } :
    sort === 'za' ? { firstName: 'desc' } :
    sort === 'oldest' ? { createdAt: 'asc' } :
    { createdAt: 'desc' }

  const where: Record<string, unknown> = {}
  if (role) where.systemRole = role
  if (type) where.userType = type
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (dept) {
    where.memberships = { some: { departmentId: dept, endedAt: null } }
  }

  const [users, departments, positions, filteredCount, totalUsers] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      include: {
        profile: true,
        memberships: { include: { department: true, position: true } },
        roleAssignments: { where: { status: 'ACTIVE' }, include: { department: true } },
      },
      ...(viewAll ? {} : { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    }),
    prisma.department.findMany({
      where: { status: 'ACTIVE', parentId: { not: null } },
      orderBy: { sortOrder: 'asc' },
      include: { positions: true },
    }),
    prisma.position.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
  ])

  const hasFilters = !!(q || role || type || dept)
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  const buildHref = (targetPage: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (role) sp.set('role', role)
    if (type) sp.set('type', type)
    if (dept) sp.set('dept', dept)
    if (sort) sp.set('sort', sort)
    if (targetPage > 1) sp.set('page', String(targetPage))
    return `?${sp.toString()}`
  }

  const viewAllHref = (() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (role) sp.set('role', role)
    if (type) sp.set('type', type)
    if (dept) sp.set('dept', dept)
    if (sort) sp.set('sort', sort)
    sp.set('view', 'all')
    return `?${sp.toString()}`
  })()

  const paginatedHref = (() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (role) sp.set('role', role)
    if (type) sp.set('type', type)
    if (dept) sp.set('dept', dept)
    if (sort) sp.set('sort', sort)
    return `?${sp.toString()}`
  })()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-bold tracking-tight">Users</h2>
            <p className="text-xs text-muted-foreground">
              {hasFilters
                ? `${filteredCount} of ${totalUsers} user${totalUsers !== 1 ? 's' : ''}`
                : `${totalUsers} user${totalUsers !== 1 ? 's' : ''} registered`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {viewAll ? (
            <Link href={paginatedHref} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <LayoutList className="h-3 w-3" />
              Paginate ({PAGE_SIZE}/page)
            </Link>
          ) : (
            filteredCount > PAGE_SIZE && (
              <Link href={viewAllHref} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <LayoutList className="h-3 w-3" />
                View All
              </Link>
            )
          )}
          {!canEdit && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-warning/10 text-warning border border-warning/20">
              View Only
            </span>
          )}
        </div>
      </div>

      <AddUserPanel canEdit={canEdit} />

      <div className="rounded-lg border bg-card p-3">
        <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
          <FilterBar
            filters={[
              {
                key: 'role',
                label: 'Role',
                options: [
                  { value: 'SUPER_ADMIN', label: 'Super Admin' },
                  { value: 'SYSTEM_ADMIN', label: 'System Admin' },
                  { value: 'EXECUTIVE', label: 'Executive' },
                  { value: 'DEPT_MANAGER', label: 'Dept Manager' },
                  { value: 'STAFF', label: 'Staff' },
                  { value: 'VA', label: 'VA' },
                ],
              },
              {
                key: 'type',
                label: 'Type',
                options: [
                  { value: 'INTERNAL_STAFF', label: 'Internal' },
                  { value: 'VIRTUAL_ASSISTANT', label: 'Virtual Assistant' },
                ],
              },
              ...(departments.length > 0
                ? [{
                    key: 'dept',
                    label: 'Department',
                    options: departments.map((d) => ({ value: d.id, label: d.name })),
                  }]
                : []),
              {
                key: 'sort',
                label: 'Sort',
                placeholder: 'Newest',
                options: [
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'az', label: 'A → Z' },
                  { value: 'za', label: 'Z → A' },
                ],
              },
            ]}
            searchPlaceholder="Search name or email..."
          />
        </Suspense>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No users match your filters.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={{
                id: u.id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                systemRole: u.systemRole,
                userType: u.userType,
                isActive: u.isActive,
                onHold: u.onHold,
                memberships: u.memberships.map((m) => ({
                  id: m.id,
                  department: { id: m.department.id, name: m.department.name },
                  position: m.position ? { id: m.position.id, title: m.position.title } : null,
                  isPrimary: m.isPrimary,
                })),
                roleAssignments: u.roleAssignments.map((ra) => ({
                  id: ra.id,
                  module: ra.module,
                  role: ra.role,
                  department: ra.department ? { id: ra.department.id, name: ra.department.name } : null,
                })),
              }}
              departments={departments.map((d) => ({
                id: d.id,
                name: d.name,
                positions: d.positions.map((p) => ({ id: p.id, title: p.title })),
              }))}
              positions={positions.map((p) => ({ id: p.id, title: p.title }))}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {!viewAll && (
        <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
      )}
    </div>
  )
}
