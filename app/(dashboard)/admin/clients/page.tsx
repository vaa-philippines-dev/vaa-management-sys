import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, LayoutList } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { FilterBar } from '@/components/filters/FilterBar'
import { Pagination } from '@/components/ui/pagination'
import { ClientAdminBoard } from '@/components/clients/ClientAdminBoard'
import type { ClientAdminData } from '@/components/clients/ClientAdminRow'

const adminViewRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']
const PAGE_SIZE = 30

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !adminViewRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }
  const canEdit = canMutate(currentUser)

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const viewAll = params.view === 'all'
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { contactName: { contains: q, mode: 'insensitive' as const } },
          { contactEmail: { contains: q, mode: 'insensitive' as const } },
          { industry: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [clients, totalCount, departments, managers, skills] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignments: { select: { id: true } },
      },
      orderBy: [{ department: { sortOrder: 'asc' } }, { name: 'asc' }],
      ...(viewAll ? {} : { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    }),
    prisma.client.count({ where }),
    prisma.department.findMany({
      where: { level: 'SERVICE', status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.findMany({
      where: { userType: 'INTERNAL_STAFF' },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.skill.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
  ])

  const skillNames = skills.map((s) => s.name)
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const boardClients: ClientAdminData[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    platform: c.platform,
    industry: c.industry,
    timezone: c.timezone,
    website: c.website,
    notes: c.notes,
    status: c.status,
    onHold: c.onHold,
    isActive: c.isActive,
    managerId: c.managerId,
    departmentId: c.departmentId,
    requiredSkills: c.requiredSkills,
    department: c.department,
    manager: c.manager,
    assignmentCount: c.assignments.length,
  }))

  const buildHref = (targetPage: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (targetPage > 1) sp.set('page', String(targetPage))
    return `?${sp.toString()}`
  }
  const viewAllHref = (() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    sp.set('view', 'all')
    return `?${sp.toString()}`
  })()
  const paginatedHref = (() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    return `?${sp.toString()}`
  })()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Client Assignments</h2>
          <p className="text-xs text-muted-foreground">
            {canEdit ? 'Rename, edit, or delete any client assignment across all departments.' : 'Admin-level client assignment management (view-only).'}
          </p>
        </div>
        {viewAll ? (
          <Link href={paginatedHref} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline shrink-0">
            <LayoutList className="h-3.5 w-3.5" />
            Paginate ({PAGE_SIZE}/page)
          </Link>
        ) : (
          totalCount > PAGE_SIZE && (
            <Link href={viewAllHref} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline shrink-0">
              <LayoutList className="h-3.5 w-3.5" />
              View All ({totalCount})
            </Link>
          )
        )}
      </div>

      <div className="rounded-lg border bg-card p-2.5">
        <FilterBar filters={[]} searchPlaceholder="Search client assignments..." />
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
              <Building2 className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No client assignments found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {q ? 'Try a different search.' : 'Client assignments created across the app will show up here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ClientAdminBoard
          clients={boardClients}
          departments={departments}
          managers={managers}
          skills={skillNames}
          canEdit={canEdit}
        />
      )}

      {!viewAll && <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />}
    </div>
  )
}
