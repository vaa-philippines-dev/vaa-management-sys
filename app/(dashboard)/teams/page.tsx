import { prisma } from '@/lib/prisma'
import { getCurrentUser, isDepartmentUnrestricted, getManagedDepartmentIds } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { TEAM_MANAGE_ROLES } from '@/lib/auth'
import { TeamsBrowser } from '@/components/teams/TeamsBrowser'
import { TeamDetailView } from '@/components/teams/TeamDetailView'
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
      include: { department: true },
      orderBy: { name: 'asc' },
    })

    if (affiliatedTeams.length === 1) {
      return <TeamViews teamIds={[affiliatedTeams[0].id]} user={user} />
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
          <p className="text-sm text-muted-foreground mt-1">Teams you&apos;re affiliated with</p>
        </div>
        <TeamsBrowser teams={affiliatedTeams} />
      </div>
    )
  }

  const managedIds = getManagedDepartmentIds(user)
  const teams = await cached(
    `teams:list:${isAdmin ? 'all' : managedIds.join(',')}`,
    [CACHE_TAGS.teams],
    60,
    () =>
      prisma.team.findMany({
        // Archived teams (e.g. Amazon's old Team 03/07, folded into the
        // others) stay reachable from Admin > Teams, not here.
        where: isAdmin ? { status: 'ACTIVE' } : { departmentId: { in: managedIds }, status: 'ACTIVE' },
        include: { department: true, _count: { select: { memberships: { where: { endedAt: null } } } } },
        orderBy: { name: 'asc' },
      })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Teams within your department{isAdmin ? 's' : ''}
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

      <TeamsBrowser teams={teams} />
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
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
        <p className="text-sm text-muted-foreground">You aren&apos;t leading a team yet.</p>
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
