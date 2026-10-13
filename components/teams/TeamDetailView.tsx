import { prisma } from '@/lib/prisma'
import { getCurrentUser, isDepartmentUnrestricted, getManagedDepartmentIds, TEAM_MANAGE_ROLES, TEAM_LEADER_ASSIGN_ROLES } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Briefcase,
  CalendarRange,
  CircleCheck,
  ClipboardList,
  Crown,
  ListChecks,
  PauseCircle,
  ShieldHalf,
  UserX,
  Users,
  UsersRound,
} from 'lucide-react'
import { TeamDetailControls } from '@/components/teams/TeamDetailControls'
import { TeamRoster, type TeamMemberRow } from '@/components/teams/TeamRoster'
import { TeamNameEditor } from '@/components/teams/TeamNameEditor'
import { StructureCard } from '@/components/departments/StructureCard'
import { isTeamScoped, getLedTeamScope } from '@/lib/scope'
import { getTeamCandidates } from '@/lib/teams'
import { rosterBucket, type RosterBucket } from '@/lib/team-roster-fields'
import { cn } from '@/lib/utils'

function userName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`
}

type Viewer = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

// Roles that can open /tmf for a team they don't lead (mirrors getTmfTeams()).
const TMF_OVERSIGHT_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'HR', 'DEPT_MANAGER', 'OPERATIONS_MANAGER']

// One team's page: leaders, roster and (for managers) the membership controls.
// Rendered by /teams/[id], and inline on /teams for a Team Leader, who only
// ever has the one team — `showBack` is off there since /teams is the page.
export async function TeamDetailView({
  teamId: id,
  user,
  showBack = true,
}: {
  teamId: string
  user: Viewer
  showBack?: boolean
}) {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      department: true,
      leader: true,
      tempLeader1: true,
      tempLeader2: true,
      memberships: {
        where: { endedAt: null },
        include: {
          user: {
            include: {
              vaProfile: {
                select: {
                  id: true,
                  status: true,
                  availabilityStatus: true,
                  vaaPosition: true,
                  positionSkill: { select: { shortName: true } },
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'asc' },
      },
    },
  })

  if (!team) notFound()

  const isAdmin = isDepartmentUnrestricted(user)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'
  const viewerLeads = [team.leaderId, team.tempLeader1Id, team.tempLeader2Id].includes(user.id)

  // Scope check: managers/ops managers must have this team's department in their
  // managed set; full admins are unrestricted. VA-type viewers must be affiliated.
  if (!isAdmin) {
    if (isVA) {
      const affiliated = viewerLeads || team.memberships.some((m) => m.userId === user.id)
      if (!affiliated) notFound()
    } else if (isTeamScoped(user)) {
      // TEAM_LEADER SystemRole on a staff account: only the teams they lead.
      const { teamIds } = await getLedTeamScope(user.id)
      if (!teamIds.includes(team.id)) notFound()
    } else {
      const managedIds = getManagedDepartmentIds(user)
      if (!managedIds.includes(team.departmentId)) notFound()
    }
  }

  const canManageMembership = TEAM_MANAGE_ROLES.includes(user.systemRole)
  const canAssignLeaders = TEAM_LEADER_ASSIGN_ROLES.includes(user.systemRole)
  // A plain team member sees who's on the team, not their teammates' clients.
  const canSeeWork = !isVA || viewerLeads

  // This department's active engagements per member — another department's
  // clients stay out, same rule as Team Assignment.
  const vaProfileIds = team.memberships.map((m) => m.user.vaProfile?.id).filter((v): v is string => !!v)
  const assignments =
    canSeeWork && vaProfileIds.length > 0
      ? await prisma.assignment.findMany({
          where: { vaProfileId: { in: vaProfileIds }, status: 'ACTIVE', client: { departmentId: team.departmentId } },
          select: { vaProfileId: true, agreedHours: true, client: { select: { id: true, name: true } } },
          orderBy: { startDate: 'asc' },
        })
      : []
  const clientsByProfile = new Map<string, { id: string; name: string; hours: number }[]>()
  for (const a of assignments) {
    const list = clientsByProfile.get(a.vaProfileId) ?? []
    list.push({ id: a.client.id, name: a.client.name, hours: Number(a.agreedHours) })
    clientsByProfile.set(a.vaProfileId, list)
  }

  const members: TeamMemberRow[] = team.memberships.map((m) => {
    const profile = m.user.vaProfile
    const clients = canSeeWork ? (profile ? clientsByProfile.get(profile.id) ?? [] : []) : null
    return {
      membershipId: m.id,
      userId: m.userId,
      name: userName(m.user),
      availabilityStatus: profile?.availabilityStatus ?? null,
      vaStatus: profile?.status ?? null,
      vaProfileId: profile?.id ?? null,
      position: profile?.positionSkill?.shortName ?? profile?.vaaPosition ?? null,
      clients,
      agreedHours: (clients ?? []).reduce((sum, c) => sum + c.hours, 0),
    }
  })

  const buckets: Record<RosterBucket, number> = { AVAILABLE: 0, ASSIGNED: 0, ON_HOLD: 0, ENDED: 0 }
  for (const m of members) {
    const b = rosterBucket(m)
    if (b) buckets[b] += 1
  }
  const clientCount = new Set(assignments.map((a) => a.client.id)).size

  let candidates: { userId: string; name: string; isVA: boolean }[] = []
  let otherTeams: { id: string; name: string }[] = []

  if (canManageMembership) {
    candidates = await getTeamCandidates(team.departmentId, members.map((m) => m.userId))

    const managedIds = isAdmin ? undefined : getManagedDepartmentIds(user)
    otherTeams = await prisma.team.findMany({
      where: {
        id: { not: team.id },
        status: 'ACTIVE',
        ...(managedIds ? { departmentId: { in: managedIds } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  // Shortcuts to the team's other pages, only where the viewer can open them.
  const quickLinks = [
    ...(viewerLeads || !isVA
      ? [{ href: `/team-assignment?dept=${team.departmentId}&team=${team.id}`, label: 'Team Assignment', icon: ListChecks }]
      : []),
    ...(viewerLeads || TMF_OVERSIGHT_ROLES.includes(user.systemRole)
      ? [{ href: `/tmf?team=${team.id}`, label: 'Team Monitoring', icon: ClipboardList }]
      : []),
    ...(!isVA ? [{ href: '/va-availability', label: 'VA Availability', icon: CalendarRange }] : []),
  ]

  const leaderNames = [team.leader, team.tempLeader1, team.tempLeader2].filter(Boolean).length

  return (
    <div data-wide-page className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          {showBack && (
            <Link href="/teams">
              <Button variant="ghost" size="icon" aria-label="Back to teams">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <UsersRound className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {canManageMembership ? (
                <TeamNameEditor teamId={team.id} name={team.name} />
              ) : (
                <h2 className="text-2xl font-bold tracking-tight">{team.name}</h2>
              )}
              <Badge variant="outline">{team.department.name}</Badge>
              {viewerLeads && (
                <Badge className="gap-1">
                  <Crown className="h-3 w-3" />
                  {team.leaderId === user.id ? 'You lead this team' : 'You are a temp leader'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {members.length} member{members.length === 1 ? '' : 's'}
              {canSeeWork && ` · ${clientCount} client${clientCount === 1 ? '' : 's'} in ${team.department.name}`}
              {` · ${leaderNames} of 3 leader slots filled`}
            </p>
          </div>
          {quickLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickLinks.map((l) => (
                <Link key={l.href} href={l.href}>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-card">
                    <l.icon className="h-3.5 w-3.5" />
                    {l.label}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cn('grid gap-3 grid-cols-2 md:grid-cols-3', buckets.ENDED > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <MiniStat icon={Users} label="Members" value={members.length} />
        <MiniStat icon={CircleCheck} label="Available" value={buckets.AVAILABLE} tone="text-success" />
        <MiniStat icon={Briefcase} label="Assigned" value={buckets.ASSIGNED} tone="text-info" />
        <MiniStat icon={PauseCircle} label="On hold / Unavailable" value={buckets.ON_HOLD} tone="text-warning" />
        {buckets.ENDED > 0 && (
          <MiniStat icon={UserX} label="Left VAA, still listed" value={buckets.ENDED} tone="text-destructive" />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StructureCard label="Team Leader" people={team.leader ? [team.leader] : []} icon={Crown} />
        <StructureCard label="Temp Leader 1" people={team.tempLeader1 ? [team.tempLeader1] : []} icon={ShieldHalf} />
        <StructureCard label="Temp Leader 2" people={team.tempLeader2 ? [team.tempLeader2] : []} icon={ShieldHalf} />
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
          linkProfiles={!isVA}
        />
      ) : (
        <TeamRoster
          members={members}
          leaderId={team.leaderId}
          tempLeader1Id={team.tempLeader1Id}
          tempLeader2Id={team.tempLeader2Id}
          linkProfiles={!isVA}
        />
      )}
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = 'text-muted-foreground',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted', tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  )
}
