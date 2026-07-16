import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { UsersRound, CheckCircle2, Crown } from 'lucide-react'
import { AdminTeamsBrowser, type AdminTeamRow } from '@/components/teams/AdminTeamsBrowser'

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
        <TeamsOverview canDelete={canEdit} />
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

async function TeamsOverview({ canDelete }: { canDelete: boolean }) {
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

  const rows: AdminTeamRow[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    departmentId: t.departmentId,
    departmentName: t.department.name,
    leaderName: t.leader ? `${t.leader.firstName} ${t.leader.lastName}` : null,
    memberCount: t._count.memberships,
  }))

  return <AdminTeamsBrowser teams={rows} canDelete={canDelete} />
}

function TeamsGridSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
        </div>
      ))}
    </div>
  )
}
