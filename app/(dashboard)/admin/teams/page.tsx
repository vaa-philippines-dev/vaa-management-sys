import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { UsersRound, Building2, Crown, CheckCircle2 } from 'lucide-react'

const adminViewRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

export default async function AdminTeamsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !adminViewRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }
  const canEdit = canMutate(currentUser)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Teams</h2>
          <p className="text-xs text-muted-foreground">
            Org-wide overview of every team across all departments
          </p>
        </div>
        {!canEdit && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-warning/10 text-warning border border-warning/20">
            View Only
          </span>
        )}
      </div>

      <Suspense fallback={<Skeleton className="h-24 rounded-lg" />}>
        <StatsHeader />
      </Suspense>

      <Suspense fallback={<TeamsGridSkeleton />}>
        <TeamsOverview />
      </Suspense>
    </div>
  )
}

async function StatsHeader() {
  const stats = await cached('admin:teamStats', [CACHE_TAGS.teams, CACHE_TAGS.admin], 60, async () => {
    const [total, withLeader, vacantLeader, totalMembers] = await Promise.all([
      prisma.team.count(),
      prisma.team.count({ where: { leaderId: { not: null } } }),
      prisma.team.count({ where: { leaderId: null } }),
      prisma.teamMembership.count({ where: { endedAt: null } }),
    ])
    return { total, withLeader, vacantLeader, totalMembers }
  })

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <div className="rounded-lg border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Teams</span>
          <UsersRound className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold leading-none">{stats.total}</p>
      </div>
      <div className="rounded-lg border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">With Leader</span>
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        </div>
        <p className="text-2xl font-bold leading-none text-success">{stats.withLeader}</p>
      </div>
      <div className="rounded-lg border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vacant Leader</span>
          <Crown className="h-3.5 w-3.5 text-amber-600" />
        </div>
        <p className="text-2xl font-bold leading-none">{stats.vacantLeader}</p>
      </div>
      <div className="rounded-lg border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Members</span>
          <UsersRound className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <p className="text-2xl font-bold leading-none">{stats.totalMembers}</p>
      </div>
    </div>
  )
}

async function TeamsOverview() {
  const teams = await cached('admin:teamsList', [CACHE_TAGS.teams, CACHE_TAGS.admin], 60, () =>
    prisma.team.findMany({
      include: {
        department: { select: { name: true } },
        leader: { select: { firstName: true, lastName: true } },
        _count: { select: { memberships: { where: { endedAt: null } } } },
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    })
  )

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
            <UsersRound className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">No teams yet</p>
          <p className="text-xs text-muted-foreground mt-1">Teams created across departments will appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger">
      {teams.map((t) => (
        <Link key={t.id} href={`/teams/${t.id}`}>
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UsersRound className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-semibold truncate">{t.name}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{t.department.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Crown className="h-3 w-3" />
                <span className="truncate">{t.leader ? `${t.leader.firstName} ${t.leader.lastName}` : 'Vacant'}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span>{t._count.memberships} member{t._count.memberships === 1 ? '' : 's'}</span>
                {!t.leader && (
                  <Badge variant="outline" className="text-[9px]">No Leader</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

function TeamsGridSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}
