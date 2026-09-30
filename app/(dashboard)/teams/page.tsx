import { prisma } from '@/lib/prisma'
import { getCurrentUser, isDepartmentUnrestricted, getManagedDepartmentIds } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { TEAM_MANAGE_ROLES } from '@/lib/auth'
import { TeamsBrowser } from '@/components/teams/TeamsBrowser'
import { isTeamScoped, getLedTeamScope } from '@/lib/scope'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const isAdmin = isDepartmentUnrestricted(user)
  const canCreate = TEAM_MANAGE_ROLES.includes(user.systemRole)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'

  if (isVA) {
    const affiliatedTeams = await prisma.team.findMany({
      where: {
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
      redirect(`/teams/${affiliatedTeams[0].id}`)
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

  // A team-scoped Team Leader (TEAM_LEADER SystemRole, staff account) sees
  // only the teams they lead, not every team in their department.
  const teamScoped = isTeamScoped(user)
  const ledTeamIds = teamScoped ? (await getLedTeamScope(user.id)).teamIds : []
  const managedIds = getManagedDepartmentIds(user)
  const teams = await cached(
    teamScoped
      ? `teams:list:led:${user.id}:${[...ledTeamIds].sort().join(',')}`
      : `teams:list:${isAdmin ? 'all' : managedIds.join(',')}`,
    [CACHE_TAGS.teams],
    60,
    () =>
      prisma.team.findMany({
        where: teamScoped
          ? { id: { in: ledTeamIds } }
          : isAdmin ? undefined : { departmentId: { in: managedIds } },
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
            {teamScoped ? 'Teams you lead' : <>Teams within your department{isAdmin ? 's' : ''}</>}
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
