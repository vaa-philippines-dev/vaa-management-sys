import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate, getManagedDepartmentIds, TEAM_MANAGE_ROLES, TEAM_LEADER_ASSIGN_ROLES } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { ArrowLeft, Crown, ShieldHalf, Users, UsersRound } from 'lucide-react'
import { TeamDetailControls } from '@/components/teams/TeamDetailControls'
import { TeamNameEditor } from '@/components/teams/TeamNameEditor'
import { cn } from '@/lib/utils'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

const AVAILABILITY_TONE: Record<string, Tone> = {
  AVAILABLE: 'success',
  PARTIALLY_ASSIGNED: 'info',
  FULLY_ASSIGNED: 'warning',
  ON_LEAVE: 'neutral',
  UNAVAILABLE: 'destructive',
}

const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_ASSIGNED: 'Partially Assigned',
  FULLY_ASSIGNED: 'Fully Assigned',
  ON_LEAVE: 'On Leave',
  UNAVAILABLE: 'Unavailable',
}

function userName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      department: true,
      leader: true,
      tempLeader1: true,
      tempLeader2: true,
      memberships: {
        where: { endedAt: null },
        include: { user: { include: { vaProfile: true } } },
        orderBy: { startedAt: 'asc' },
      },
    },
  })

  if (!team) notFound()

  const isAdmin = canMutate(user)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'

  // Scope check: managers/ops managers must have this team's department in their
  // managed set; full admins are unrestricted. VA-type viewers must be affiliated.
  if (!isAdmin) {
    if (isVA) {
      const affiliated =
        team.leaderId === user.id ||
        team.tempLeader1Id === user.id ||
        team.tempLeader2Id === user.id ||
        team.memberships.some((m) => m.userId === user.id)
      if (!affiliated) notFound()
    } else {
      const managedIds = getManagedDepartmentIds(user)
      if (!managedIds.includes(team.departmentId)) notFound()
    }
  }

  const canManageMembership = TEAM_MANAGE_ROLES.includes(user.systemRole)
  const canAssignLeaders = TEAM_LEADER_ASSIGN_ROLES.includes(user.systemRole)

  const members = team.memberships.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    name: userName(m.user),
    availabilityStatus: m.user.vaProfile?.availabilityStatus ?? null,
  }))

  let candidates: { userId: string; name: string }[] = []
  let otherTeams: { id: string; name: string }[] = []

  if (canManageMembership) {
    const memberIds = new Set(members.map((m) => m.userId))
    const deptMembers = await prisma.departmentMembership.findMany({
      where: { departmentId: team.departmentId, endedAt: null },
      include: { user: true },
    })
    candidates = deptMembers
      .filter((dm) => !memberIds.has(dm.userId))
      .map((dm) => ({ userId: dm.userId, name: userName(dm.user) }))

    const managedIds = isAdmin ? undefined : getManagedDepartmentIds(user)
    otherTeams = await prisma.team.findMany({
      where: {
        id: { not: team.id },
        ...(managedIds ? { departmentId: { in: managedIds } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center gap-3">
        <Link href="/teams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UsersRound className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {canManageMembership ? (
              <TeamNameEditor teamId={team.id} name={team.name} />
            ) : (
              <h2 className="text-2xl font-bold tracking-tight">{team.name}</h2>
            )}
            <Badge variant="outline">{team.department.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {team.memberships.length} member{team.memberships.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 fade-in-stagger">
        <LeaderCard label="Team Leader" user={team.leader} icon={Crown} />
        <LeaderCard label="Temp Leader 1" user={team.tempLeader1} icon={ShieldHalf} />
        <LeaderCard label="Temp Leader 2" user={team.tempLeader2} icon={ShieldHalf} />
      </div>

      {canManageMembership || canAssignLeaders ? (
        <TeamDetailControls
          teamId={team.id}
          members={members}
          candidates={candidates}
          otherTeams={otherTeams}
          canManageMembership={canManageMembership}
          canAssignLeaders={canAssignLeaders}
          leaderId={team.leaderId}
          tempLeader1Id={team.tempLeader1Id}
          tempLeader2Id={team.tempLeader2Id}
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Members ({members.length})</p>
          </div>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No members yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.membershipId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials(m.name)}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                  {(m.userId === team.leaderId || m.userId === team.tempLeader1Id || m.userId === team.tempLeader2Id) && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {m.userId === team.leaderId ? (
                        <Crown className="h-2.5 w-2.5" />
                      ) : (
                        <ShieldHalf className="h-2.5 w-2.5" />
                      )}
                      {m.userId === team.leaderId ? 'Leader' : 'Temp Leader'}
                    </Badge>
                  )}
                  <StatusIndicator tone={AVAILABILITY_TONE[m.availabilityStatus ?? ''] ?? 'neutral'}>
                    {AVAILABILITY_LABEL[m.availabilityStatus ?? ''] ?? m.availabilityStatus ?? 'Unknown'}
                  </StatusIndicator>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LeaderCard({
  label,
  user,
  icon: Icon,
}: {
  label: string
  user: { firstName: string; lastName: string } | null
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', user ? 'text-primary' : 'text-muted-foreground/40')} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {user && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {initials(userName(user))}
          </span>
        )}
        <p className="text-sm font-semibold">
          {user ? userName(user) : <span className="text-muted-foreground/60 font-normal">Vacant</span>}
        </p>
      </div>
    </div>
  )
}
