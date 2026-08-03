import { prisma } from '@/lib/prisma'
import { getCurrentUser, AGENT_MUTATOR_ROLES } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Bot } from 'lucide-react'
import { AgentSuggestionCard, type SuggestionForCard } from '@/components/agent/AgentSuggestionCard'

// Matches REPORTS_VIEW_ROLES in reports/page.tsx exactly — same nav section
// ("On Going"), same visibility rule: every non-VA role can view, only
// AGENT_MUTATOR_ROLES (lib/auth.ts) can actually decide on a suggestion.
const AGENT_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF', 'HR']

const STATUS_TABS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
] as const

const KIND_PRIORITY: Record<SuggestionForCard['kind'], number> = {
  STALLED_HANDOFF: 0,
  NO_MATCH_FOUND: 1,
  ONBOARDING_CHECKLIST: 2,
  WELCOME_MESSAGE: 3,
  VA_MATCH: 4,
}

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !AGENT_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }
  const canDecide = AGENT_MUTATOR_ROLES.includes(currentUser.systemRole)

  const { status } = await searchParams
  const statusFilter = (STATUS_TABS.find((t) => t.value === status)?.value ?? 'PENDING') as (typeof STATUS_TABS)[number]['value']

  const [suggestions, pendingCounts] = await Promise.all([
    cached(`agent:suggestions:${statusFilter}`, [CACHE_TAGS.agent], 10, () =>
      prisma.agentSuggestion.findMany({
        where: statusFilter === 'ALL' ? {} : { status: statusFilter },
        include: {
          client: { select: { id: true, name: true, platform: true, industry: true } },
          decidedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      })
    ),
    cached(`agent:pendingCounts`, [CACHE_TAGS.agent], 10, () =>
      prisma.agentSuggestion.groupBy({ by: ['kind'], where: { status: 'PENDING' }, _count: { _all: true } })
    ),
  ])

  const totalPending = pendingCounts.reduce((sum, c) => sum + c._count._all, 0)

  // cached() round-trips through unstable_cache's JSON serialization, so
  // Date fields come back as strings, not Date objects — restore them before
  // anything below calls .getTime()/date-fns on them.
  const normalized = suggestions.map((s) => ({
    ...s,
    createdAt: new Date(s.createdAt),
    decidedAt: s.decidedAt ? new Date(s.decidedAt) : null,
  }))

  type Group = { key: string; label: string; platform: string | null; latest: Date; items: typeof normalized }
  const groups = new Map<string, Group>()

  for (const s of normalized) {
    const payload = s.payload && typeof s.payload === 'object' ? (s.payload as Record<string, unknown>) : {}
    const key = s.clientId ?? `account:${typeof payload.accountId === 'string' ? payload.accountId : 'unknown'}`
    const label = s.client?.name ?? (typeof payload.accountLabel === 'string' ? payload.accountLabel : 'Unassigned account')

    const existing = groups.get(key)
    if (existing) {
      existing.items.push(s)
      if (s.createdAt > existing.latest) existing.latest = s.createdAt
    } else {
      groups.set(key, { key, label, platform: s.client?.platform ?? null, latest: s.createdAt, items: [s] })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bot className="h-6 w-6" />
            AI Agent
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            VA match suggestions and onboarding pipeline flags awaiting review.
            {!canDecide && ' You have view-only access to this page.'}
          </p>
        </div>
      </div>

      {totalPending > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {pendingCounts.map((c) => (
            <span key={c.kind} className="rounded-full bg-muted px-2.5 py-1">
              {c._count._all} pending {c.kind.replace(/_/g, ' ').toLowerCase()}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/agent?status=${tab.value}`}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              statusFilter === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {sortedGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'PENDING' ? 'Nothing awaiting review right now.' : 'No suggestions in this view.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 fade-in-stagger">
          {sortedGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold">{group.label}</h3>
                {group.platform && <span className="text-xs text-muted-foreground">{group.platform}</span>}
              </div>
              <div className="space-y-2">
                {group.items.map((s) => (
                  <AgentSuggestionCard key={s.id} suggestion={s as SuggestionForCard} canDecide={canDecide} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
