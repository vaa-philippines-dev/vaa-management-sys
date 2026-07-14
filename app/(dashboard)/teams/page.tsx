import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate, getManagedDepartmentIds } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, UsersRound } from 'lucide-react'
import { TEAM_MANAGE_ROLES } from '@/lib/auth'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const isAdmin = canMutate(user)
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
        <TeamGrid teams={affiliatedTeams} />
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
        where: isAdmin ? undefined : { departmentId: { in: managedIds } },
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

      <TeamGrid teams={teams} />
    </div>
  )
}

function TeamGrid({
  teams,
}: {
  teams: Array<{
    id: string
    name: string
    department: { name: string }
    _count?: { memberships: number }
  }>
}) {
  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <UsersRound className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger">
      {teams.map((t) => (
        <Link key={t.id} href={`/teams/${t.id}`}>
          <Card className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">{t.name}</CardTitle>
                <Badge variant="outline" className="text-xs shrink-0">{t.department.name}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t._count?.memberships ?? 0} member{(t._count?.memberships ?? 0) === 1 ? '' : 's'}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
