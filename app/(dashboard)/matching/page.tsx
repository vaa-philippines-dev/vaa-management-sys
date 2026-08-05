import { prisma } from '@/lib/prisma'
import { getCurrentUser, AGENT_MUTATOR_ROLES } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Handshake } from 'lucide-react'
import { KIND_LABEL, type SuggestionForCard } from '@/components/agent/AgentSuggestionCard'
import { MatchingFilters } from '@/components/agent/MatchingFilters'
import { SuggestionGroupList } from '@/components/agent/SuggestionGroupList'
import type { SuggestionGroup } from '@/components/agent/SuggestionGroupCard'

// Matches REPORTS_VIEW_ROLES in reports/page.tsx exactly — same nav section
// ("On Going"), same visibility rule: every non-VA role can view, only
// AGENT_MUTATOR_ROLES (lib/auth.ts) can actually decide on a suggestion.
const AGENT_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF', 'HR']

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const
const VALID_KINDS: SuggestionForCard['kind'][] = [
  'VA_MATCH',
  'NO_MATCH_FOUND',
  'ONBOARDING_CHECKLIST',
  'WELCOME_MESSAGE',
  'STALLED_HANDOFF',
]

const KIND_PRIORITY: Record<SuggestionForCard['kind'], number> = {
  STALLED_HANDOFF: 0,
  NO_MATCH_FOUND: 1,
  ONBOARDING_CHECKLIST: 2,
  WELCOME_MESSAGE: 3,
  VA_MATCH: 4,
}

/**
 * Turns a client's intake fields into one readable sentence — this is the
 * "what did they actually ask for" context a reviewer needs alongside a VA
 * shortlist, which the suggestion cards alone don't carry (payload is about
 * the candidate VA, not the client's original request).
 */
function buildClientRequestSummary(client: {
  serviceType: string | null
  businessModel: string | null
  industry: string | null
  requiredSkills: string[]
  notes: string | null
} | null): string {
  if (!client) return 'No client record linked yet.'
  const bits: string[] = []
  if (client.serviceType) bits.push(client.serviceType)
  if (client.industry) bits.push(`${client.industry} industry`)
  if (client.requiredSkills.length > 0) bits.push(`Needs: ${client.requiredSkills.join(', ')}`)
  if (client.businessModel) bits.push(client.businessModel)
  if (client.notes) bits.push(client.notes)
  return bits.length > 0 ? bits.join('. ') + '.' : 'No request details recorded for this client yet.'
}

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; department?: string; kind?: string; q?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !AGENT_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }
  const canDecide = AGENT_MUTATOR_ROLES.includes(currentUser.systemRole)

  const { status, department, kind, q } = await searchParams
  const statusFilter = VALID_STATUSES.includes(status as never) ? (status as (typeof VALID_STATUSES)[number]) : 'PENDING'
  const kindFilter = VALID_KINDS.includes(kind as never) ? (kind as SuggestionForCard['kind']) : null
  const departmentFilter = department && department !== 'ALL' ? department : null
  const searchQuery = q?.trim().toLowerCase() || null

  const [suggestions, pendingCounts, departments] = await Promise.all([
    cached(`matching:suggestions:${statusFilter}`, [CACHE_TAGS.agent], 10, () =>
      prisma.agentSuggestion.findMany({
        where: statusFilter === 'ALL' ? {} : { status: statusFilter },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              platform: true,
              industry: true,
              serviceType: true,
              businessModel: true,
              requiredSkills: true,
              notes: true,
              department: { select: { id: true, name: true } },
            },
          },
          decidedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      })
    ),
    cached('matching:pendingCounts', [CACHE_TAGS.agent], 10, () =>
      prisma.agentSuggestion.groupBy({ by: ['kind'], where: { status: 'PENDING' }, _count: { _all: true } })
    ),
    // Same query/pattern as serviceDepartments in app/(dashboard)/layout.tsx.
    cached('matching:departments', [CACHE_TAGS.departments], 60, () =>
      prisma.department.findMany({
        where: { level: 'SERVICE', status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    ),
  ])

  const totalPending = pendingCounts.reduce((sum, c) => sum + c._count._all, 0)

  // cached() round-trips through unstable_cache's JSON serialization, so
  // Date fields come back as strings, not Date objects — restore them before
  // anything below calls .getTime()/date-fns on them.
  const normalized = suggestions
    .map((s) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      decidedAt: s.decidedAt ? new Date(s.decidedAt) : null,
    }))
    .filter((s) => !kindFilter || s.kind === kindFilter)
    .filter((s) => !departmentFilter || s.client?.department?.id === departmentFilter)
    .filter((s) => !searchQuery || (s.client?.name ?? '').toLowerCase().includes(searchQuery))

  const groups = new Map<string, SuggestionGroup & { latest: Date }>()

  for (const s of normalized) {
    const payload = s.payload && typeof s.payload === 'object' ? (s.payload as Record<string, unknown>) : {}
    const key = s.clientId ?? `account:${typeof payload.accountId === 'string' ? payload.accountId : 'unknown'}`
    const label = s.client?.name ?? (typeof payload.accountLabel === 'string' ? payload.accountLabel : 'Unassigned account')

    const existing = groups.get(key)
    if (existing) {
      existing.items.push(s as SuggestionForCard)
      if (s.createdAt > existing.latest) existing.latest = s.createdAt
    } else {
      groups.set(key, {
        key,
        label,
        departmentName: s.client?.department?.name ?? null,
        platform: s.client?.platform ?? null,
        requestSummary: buildClientRequestSummary(s.client),
        latest: s.createdAt,
        items: [s as SuggestionForCard],
      })
    }
  }

  const sortedGroups = [...groups.values()].sort((a, b) => b.latest.getTime() - a.latest.getTime())
  for (const g of sortedGroups) {
    g.items.sort((a, b) => {
      const p = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]
      if (p !== 0) return p
      return (a.rank ?? 99) - (b.rank ?? 99)
    })
  }

  const kindOptions = VALID_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Matching</h2>
          <p className="text-sm text-muted-foreground mt-1">
            VA match suggestions and onboarding pipeline flags awaiting review.
            {!canDecide && ' You have view-only access to this page.'}
          </p>
        </div>
      </div>

      {totalPending > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pendingCounts.map((c) => (
            <Card key={c.kind}>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold tracking-tight">{c._count._all}</p>
                <p className="text-xs text-muted-foreground">{KIND_LABEL[c.kind]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MatchingFilters departments={departments} kinds={kindOptions} />

      {sortedGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Handshake className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'PENDING' && !kindFilter && !departmentFilter && !searchQuery
                ? 'Nothing awaiting review right now.'
                : 'No suggestions match these filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <SuggestionGroupList groups={sortedGroups} canDecide={canDecide} initiallyOpen={sortedGroups.length <= 8} />
      )}
    </div>
  )
}
