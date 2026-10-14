import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, getPrimaryDepartment, CLIENT_MUTATOR_ROLES } from '@/lib/auth'
import { getViewScope, getMutateScope, clientScopeWhere, scopeDepartmentIds, scopeKey, type Scope } from '@/lib/scope'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { isTeamAffiliated } from '@/lib/teams'
import { clientNiche } from '@/lib/clients/display'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Building2, CircleCheck, Hourglass, PauseCircle, CircleSlash, UserRoundX } from 'lucide-react'
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
] as const

type StatusTab = (typeof STATUS_TAB_OPTIONS)[number]['value']

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

// Totals for the tab pills, from one groupBy over (status, onHold) rather
// than a count query per tab. Must stay in step with statusTabWhere().
function countStatusTabs(groups: { status: string; onHold: boolean; _count: number }[]): Record<StatusTab, number> {
  const counts: Record<StatusTab, number> = { ACTIVE: 0, PENDING: 0, PAUSED: 0, EOC_CANCELLED: 0, ALL: 0 }
  for (const g of groups) {
    counts.ALL += g._count
    if (g.status === 'ACTIVE' && !g.onHold) counts.ACTIVE += g._count
    if (g.status === 'PENDING') counts.PENDING += g._count
    if (g.onHold) counts.PAUSED += g._count
    if (g.status === 'PROJECT_ENDED' || g.status === 'CANCELLED') counts.EOC_CANCELLED += g._count
  }
  return counts
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
  const statusTab: StatusTab =
    typeof params.status === 'string' && STATUS_TAB_OPTIONS.some((o) => o.value === params.status)
      ? (params.status as StatusTab)
      : DEFAULT_STATUS_TAB
  const statusTabLabel = STATUS_TAB_OPTIONS.find((o) => o.value === statusTab)!.label
  const q = typeof params.q === 'string' ? params.q : undefined

  // VAs are scoped by resolveClientsWhere's own branch; scope only matters for staff.
  const viewScope: Scope = user.userType === 'VIRTUAL_ASSISTANT' ? null : await getViewScope(user)
  const scopeWhere = await resolveClientsWhere(user, viewScope)
  // A team-scoped viewer only sees their own people's engagements on a client,
  // not the rest of the department's.
  const teamUserIds = viewScope?.userIds ?? null
  const searchWhere: Prisma.ClientWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { contactName: { contains: q, mode: 'insensitive' } },
          { industry: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}
  // AND, not spread: the STAFF scope and the search are both OR clauses and a
  // spread would let the search silently overwrite the scope.
  const where: Prisma.ClientWhereInput = {
    AND: [scopeWhere ?? {}, statusTabWhere(statusTab), searchWhere],
  }
  const cacheScope = `${user.id}:${q ?? ''}:${scopeKey(viewScope)}:${JSON.stringify(scopeWhere)}`

  const [clients, statusGroups] = await Promise.all([
    cached(`clients:board:${statusTab}:${cacheScope}`, [CACHE_TAGS.clients], 60, () =>
      prisma.client.findMany({
        where,
        include: {
          assignments: {
            ...(teamUserIds !== null && { where: { vaProfile: { userId: { in: teamUserIds } } } }),
            select: {
              status: true,
              vaProfile: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
            },
          },
          department: { select: { id: true, name: true, sortOrder: true } },
          account: { select: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    ),
    cached(`clients:tab-counts:${cacheScope}`, [CACHE_TAGS.clients], 60, () =>
      prisma.client.groupBy({
        by: ['status', 'onHold'],
        where: { AND: [scopeWhere ?? {}, searchWhere] },
        _count: true,
      })
    ),
  ])
  const tabCounts = countStatusTabs(statusGroups)

  // Only what the board renders — the raw row carries formDetails and other
  // intake JSON that has no business being serialized to the browser.
  const boardClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    platform: c.platform,
    status: c.status,
    onHold: c.onHold,
    contactName: c.contactName,
    industry: c.industry,
    requiredSkills: c.requiredSkills,
    department: c.department,
    category: c.account?.category ?? null,
    niche: clientNiche(c),
    // new Date(): the cached() result comes back JSON-serialized, so this is a string.
    dateAdded: dateAddedFormat.format(new Date(c.createdAt)),
    assignmentCount: c.assignments.length,
    openAssignmentCount: c.assignments.filter((a) => a.status === 'ACTIVE' || a.status === 'PAUSED' || a.status === 'ON_HOLD').length,
    // One entry per VA — the same VA can hold two active engagements on a request.
    activeVAs: Array.from(
      new Map(
        c.assignments
          .filter((a) => a.status === 'ACTIVE')
          .map((a) => [a.vaProfile.id, { id: a.vaProfile.id, name: `${a.vaProfile.user.firstName} ${a.vaProfile.user.lastName}`.trim() }])
      ).values()
    ),
  }))
  const withoutActiveVA = boardClients.filter((c) => c.activeVAs.length === 0).length

  // Tabs and stat tiles keep the current search; the default tab drops its param.
  const tabHref = (value: StatusTab) => {
    const next = new URLSearchParams()
    if (value !== DEFAULT_STATUS_TAB) next.set('status', value)
    if (q) next.set('q', q)
    const qs = next.toString()
    return qs ? `/clients?${qs}` : '/clients'
  }

  return (
    <div data-wide-page className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Client Request
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Staffing requests for e-commerce sellers and brands receiving VA support
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && <ImportClientCsvButton />}
          {canImport && <AddClientButton departments={serviceDepartments} managerId={user.id} />}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 fade-in-stagger">
        <StatCard icon={CircleCheck} label="Active" value={tabCounts.ACTIVE} href={tabHref('ACTIVE')} />
        <StatCard icon={Hourglass} label="Pending" value={tabCounts.PENDING} href={tabHref('PENDING')} />
        <StatCard icon={PauseCircle} label="Paused" value={tabCounts.PAUSED} href={tabHref('PAUSED')} />
        <StatCard icon={CircleSlash} label="EOC / Cancelled" value={tabCounts.EOC_CANCELLED} href={tabHref('EOC_CANCELLED')} />
        <StatCard icon={UserRoundX} label={`No Active VA · ${statusTabLabel}`} value={withoutActiveVA} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="inline-flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1" aria-label="Client status">
          {STATUS_TAB_OPTIONS.map((o) => {
            const active = o.value === statusTab
            return (
              <Link
                key={o.value}
                href={tabHref(o.value)}
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {o.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] tabular-nums',
                    active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tabCounts[o.value]}
                </span>
              </Link>
            )
          })}
        </nav>
        <div className="flex-1 min-w-[220px]">
          <FilterBar filters={[]} searchPlaceholder="Search client, company, niche… (Enter)" />
        </div>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {q
                ? `No ${statusTab !== 'ALL' ? statusTabLabel.toLowerCase() + ' ' : ''}client requests match “${q}”.`
                : `No ${statusTab !== 'ALL' ? statusTabLabel.toLowerCase() + ' ' : ''}client requests yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ClientsBoard clients={boardClients} canManage={canImport} />
      )}
    </div>
  )
}
