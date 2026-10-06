import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, getPrimaryDepartment, CLIENT_MUTATOR_ROLES } from '@/lib/auth'
import { getViewScope, getMutateScope, clientScopeWhere, scopeDepartmentIds, scopeKey, type Scope } from '@/lib/scope'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { isTeamAffiliated } from '@/lib/teams'
import { clientNiche } from '@/lib/clients/display'
import { Card, CardContent } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { ClientsBoard } from '@/components/clients/ClientsBoard'
import { ImportClientCsvButton } from '@/components/clients/ImportClientCsvButton'
import { AddClientButton } from '@/components/clients/AddClientButton'
import { FilterBar } from '@/components/filters/FilterBar'
import { redirect } from 'next/navigation'

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

const dateAddedFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })

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

// VAs keep their self/team scoping. Every other role goes through the shared
// department scope (lib/scope.ts): admins/HR/EXECUTIVE see all, everyone else
// only their own department(s). A TEAM_LEADER (non-VA) is narrower still:
// only the clients someone on a team they lead actually works for.
async function resolveClientsWhere(user: Awaited<ReturnType<typeof getCurrentUser>>, scope: Scope): Promise<Prisma.ClientWhereInput | undefined> {
  if (!user) return { id: { in: [] } }

  if (user.userType === 'VIRTUAL_ASSISTANT') {
    if (await isTeamAffiliated(user.id)) {
      const primaryDept = getPrimaryDepartment(user)
      return { departmentId: { in: primaryDept ? [primaryDept.id] : [] } }
    }
    // Non-team VAs get no department to scope by — restrict to clients they're
    // actually assigned to rather than falling through to "everything" below.
    return { assignments: { some: { vaProfileId: user.vaProfile?.id ?? '' } } }
  }

  if (scope === null) return undefined
  // STAFF historically saw "clients I manage"; keep that alongside their
  // departments so a client they own under another department doesn't vanish.
  if (user.systemRole === 'STAFF') {
    return { OR: [clientScopeWhere(scope), { managerId: user.id }] }
  }
  return clientScopeWhere(scope)
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const canImport = CLIENT_MUTATOR_ROLES.includes(user.systemRole)

  // Only departments the viewer may create clients in (null = all).
  const mutableDeptIds = scopeDepartmentIds(await getMutateScope(user))
  const serviceDepartments = canImport
    ? await prisma.department.findMany({
        where: { level: 'SERVICE', status: 'ACTIVE', ...(mutableDeptIds === null ? {} : { id: { in: mutableDeptIds } }) },
        select: { id: true, name: true, shortName: true, acronym: true },
        orderBy: { sortOrder: 'asc' },
      })
    : []

  const params = await searchParams
  const statusTab = typeof params.status === 'string' && STATUS_TAB_OPTIONS.some((o) => o.value === params.status)
    ? params.status
    : DEFAULT_STATUS_TAB
  const q = typeof params.q === 'string' ? params.q : undefined

  // VAs are scoped by resolveClientsWhere's own branch; scope only matters for staff.
  const viewScope: Scope = user.userType === 'VIRTUAL_ASSISTANT' ? null : await getViewScope(user)
  const scopeWhere = await resolveClientsWhere(user, viewScope)
  // A team-scoped viewer only sees their own people's engagements on a client,
  // not the rest of the department's.
  const teamUserIds = viewScope?.userIds ?? null
  // AND, not spread: the STAFF scope and the search are both OR clauses and a
  // spread would let the search silently overwrite the scope.
  const where: Prisma.ClientWhereInput = {
    AND: [
      scopeWhere ?? {},
      statusTabWhere(statusTab),
      q ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { industry: { contains: q, mode: 'insensitive' } },
      ] } : {},
    ],
  }
  const cacheKey = `clients:list:${user.id}:${statusTab}:${q ?? ''}:${scopeKey(viewScope)}:${JSON.stringify(scopeWhere)}`

  const clients = await cached(cacheKey, [CACHE_TAGS.clients], 60, () =>
    prisma.client.findMany({
      where,
      include: {
        assignments: {
          ...(teamUserIds !== null && { where: { vaProfile: { userId: { in: teamUserIds } } } }),
          include: { vaProfile: { include: { user: true } } },
        },
        department: { select: { id: true, name: true, sortOrder: true } },
        account: { select: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Client Request</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Staffing requests for e-commerce sellers and brands receiving VA support
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && <ImportClientCsvButton />}
          {canImport && user && <AddClientButton departments={serviceDepartments} managerId={user.id} />}
        </div>
      </div>

      <FilterBar
        filters={[{ key: 'status', label: 'Status', defaultValue: DEFAULT_STATUS_TAB, options: STATUS_TAB_OPTIONS }]}
        searchPlaceholder="Search client assignments..."
      />

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No {statusTab !== 'ALL' ? STATUS_TAB_OPTIONS.find((o) => o.value === statusTab)?.label.toLowerCase() : ''} client assignments yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ClientsBoard
          clients={clients.map((c) => ({
            ...c,
            category: c.account?.category ?? null,
            niche: clientNiche(c),
            // new Date(): the cached() result comes back JSON-serialized, so this is a string.
            dateAdded: dateAddedFormat.format(new Date(c.createdAt)),
          }))}
        />
      )}
    </div>
  )
}
