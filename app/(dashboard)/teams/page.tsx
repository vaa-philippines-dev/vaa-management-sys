import { prisma } from '@/lib/prisma'
import { getCurrentUser, isDepartmentUnrestricted, getManagedDepartmentIds } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, UsersRound, Briefcase, Coffee, UserMinus, AlertTriangle, CircleOff } from 'lucide-react'
import { TEAM_MANAGE_ROLES } from '@/lib/auth'
import { TeamsBrowser } from '@/components/teams/TeamsBrowser'
import { TeamDetailView } from '@/components/teams/TeamDetailView'
import { TeamsOverview } from '@/components/teams/TeamsOverview'
import { StatCard } from '@/components/ui/stat-card'
import { getTeamsOverview } from '@/lib/teams-overview'
import { isTeamScoped, getLedTeamScope } from '@/lib/scope'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const isAdmin = isDepartmentUnrestricted(user)
  const canCreate = TEAM_MANAGE_ROLES.includes(user.systemRole)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'
  const teamScoped = isTeamScoped(user)

  // Team Leaders (the TEAM_LEADER SystemRole, or a VA account that leads a
  // team) each lead a single team, so skip the card grid and open it here.
  if (teamScoped || isVA) {
    const { teamIds: ledTeamIds } = await getLedTeamScope(user.id)
    if (teamScoped || ledTeamIds.length > 0) {
      return <TeamViews teamIds={ledTeamIds} user={user} />
    }
  }

  if (isVA) {
    const affiliatedTeams = await prisma.team.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { leaderId: user.id },
          { tempLeader1Id: user.id },
          { tempLeader2Id: user.id },
          { memberships: { some: { userId: user.id, endedAt: null } } },
        ],
      },
      include: { department: true, leader: { select: { firstName: true, lastName: true } } },
      orderBy: { name: 'asc' },
    })

    if (affiliatedTeams.length === 1) {
      return <TeamViews teamIds={[affiliatedTeams[0].id]} user={user} />
    }

    return (
      <div data-wide-page className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UsersRound className="h-6 w-6" />
            Teams
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Teams you&apos;re affiliated with</p>
        </div>
        <TeamsBrowser teams={affiliatedTeams} />
      </div>
    )
  }

  // Dept/Ops Managers see their own departments' teams; admins/HR every one.
  const managedIds = getManagedDepartmentIds(user)
  const { teams, totals } = await cached(
    `teams:overview30d:${isAdmin ? 'all' : managedIds.join(',')}`,
    [CACHE_TAGS.teams, CACHE_TAGS.assignments],
    60,
    () => getTeamsOverview(isAdmin ? null : managedIds)
  )
  const departmentCount = new Set(teams.map((t) => t.departmentName)).size

  return (
    <div data-wide-page className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UsersRound className="h-6 w-6" />
            Teams
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {`${totals.teams} team${totals.teams === 1 ? '' : 's'}${
              departmentCount > 1 ? ` across ${departmentCount} departments` : ''
            } — who's working, who's free, and what needs a look`}
          </p>
        </div>
        {canCreate && (
          <Link href="/teams/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Team
            </Button>
          </Link>
        )}
      </div>

      {totals.teams > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 fade-in-stagger">
          <StatCard icon={UsersRound} label="VAs on teams" value={totals.members} />
          <StatCard icon={Briefcase} label="Active with clients" value={totals.active} />
          <StatCard icon={Coffee} label="Idle — ready to staff" value={totals.idle} href="/va-availability" />
          <StatCard icon={CircleOff} label="Unavailable / on hold" value={totals.unavailable} />
          <StatCard icon={UserMinus} label="Not on a team" value={totals.notOnTeam} href="/team-assignment" />
          <StatCard icon={AlertTriangle} label="Check-ins missed (30 days)" value={totals.overdueCheckIns} href="/performance" />
        </div>
      )}

      <TeamsOverview teams={teams} />
    </div>
  )
}

function TeamViews({
  teamIds,
  user,
}: {
  teamIds: string[]
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
}) {
  if (teamIds.length === 0) {
    return (
      <div data-wide-page className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UsersRound className="h-6 w-6" />
          Teams
        </h2>
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card px-4 py-12 text-center">
          <UsersRound className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">You aren&apos;t leading a team yet.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-10">
      {teamIds.map((id) => (
        <TeamDetailView key={id} teamId={id} user={user} showBack={false} />
      ))}
    </div>
  )
}
