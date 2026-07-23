import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, getManagedDepartmentIds, getPrimaryDepartment, CLIENT_MUTATOR_ROLES } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { isTeamAffiliated } from '@/lib/teams'
import { Card, CardContent } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { ClientsBoard } from '@/components/clients/ClientsBoard'
import { ImportClientCsvButton } from '@/components/clients/ImportClientCsvButton'
import { AddClientButton } from '@/components/clients/AddClientButton'
import { FilterBar } from '@/components/filters/FilterBar'

const DEPARTMENT_SCOPED_ROLES = ['DEPT_MANAGER', 'OPERATIONS_MANAGER']
const UNRESTRICTED_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'HR']

// The four filter tabs don't map 1:1 onto GeneralStatus — "Paused" is
// onHold=true layered on top of whatever status a client already has, and
// "EOC" reuses the existing PROJECT_ENDED value alongside CANCELLED.
const DEFAULT_STATUS_TAB = 'ACTIVE'
const STATUS_TAB_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'EOC_CANCELLED', label: 'EOC / Cancelled' },
  { value: 'ALL', label: 'All' },
]

function statusTabWhere(tab: string): Prisma.ClientWhereInput {
  switch (tab) {
    case 'ACTIVE':
      return { status: 'ACTIVE', onHold: false }
    case 'PENDING':
      return { status: 'PENDING' }
    case 'PAUSED':
      return { onHold: true }
    case 'EOC_CANCELLED':
      return { status: { in: ['PROJECT_ENDED', 'CANCELLED'] } }
    default:
      return {}
  }
}

// Department-category audience (Dept/Ops Manager, HR, admins, team-affiliated VAs)
// see clients scoped to their department, same as the former standalone Clients
// Monitoring page. Everyone else (e.g. plain STAFF) keeps the original "clients
// I personally manage" view.
async function resolveClientsWhere(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return undefined
  if (UNRESTRICTED_ROLES.includes(user.systemRole)) return undefined

  if (DEPARTMENT_SCOPED_ROLES.includes(user.systemRole)) {
    return { departmentId: { in: getManagedDepartmentIds(user) } }
  }

  if (user.userType === 'VIRTUAL_ASSISTANT' && (await isTeamAffiliated(user.id))) {
    const primaryDept = getPrimaryDepartment(user)
    return { departmentId: { in: primaryDept ? [primaryDept.id] : [] } }
  }

  return user.systemRole === 'STAFF' ? { managerId: user.id } : undefined
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  const canImport = user ? CLIENT_MUTATOR_ROLES.includes(user.systemRole) : false

  const serviceDepartments = canImport
    ? await prisma.department.findMany({
        where: { level: 'SERVICE', status: 'ACTIVE' },
        select: { id: true, name: true, shortName: true, acronym: true },
        orderBy: { sortOrder: 'asc' },
      })
    : []

  const params = await searchParams
  const statusTab = typeof params.status === 'string' && STATUS_TAB_OPTIONS.some((o) => o.value === params.status)
    ? params.status
    : DEFAULT_STATUS_TAB
  const q = typeof params.q === 'string' ? params.q : undefined

  const scopeWhere = await resolveClientsWhere(user)
  const where: Prisma.ClientWhereInput = {
    ...scopeWhere,
    ...statusTabWhere(statusTab),
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
      { industry: { contains: q, mode: 'insensitive' } },
    ] } : {}),
  }
  const cacheKey = user ? `clients:list:${user.id}:${statusTab}:${q ?? ''}:${JSON.stringify(scopeWhere)}` : `clients:list:${statusTab}:${q ?? ''}`

  const clients = await cached(cacheKey, [CACHE_TAGS.clients], 60, () =>
    prisma.client.findMany({
      where,
      include: {
        assignments: { include: { vaProfile: { include: { user: true } } } },
        department: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-sm text-muted-foreground mt-1">
            E-commerce sellers and brands receiving VA support
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && <ImportClientCsvButton />}
          {canImport && user && <AddClientButton departments={serviceDepartments} managerId={user.id} />}
        </div>
      </div>

      <FilterBar
        filters={[{ key: 'status', label: 'Status', defaultValue: DEFAULT_STATUS_TAB, options: STATUS_TAB_OPTIONS }]}
        searchPlaceholder="Search clients..."
      />

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No {statusTab !== 'ALL' ? STATUS_TAB_OPTIONS.find((o) => o.value === statusTab)?.label.toLowerCase() : ''} clients yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ClientsBoard clients={clients} />
      )}
    </div>
  )
}
