import { prisma } from '@/lib/prisma'
import {
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  getPrimaryDepartment,
  TEAM_MANAGE_ROLES,
} from '@/lib/auth'
import { getLedTeamIds } from '@/lib/teams'
import { getDepartmentTeamAssignments, countTeamMembers, type VAAssignmentState } from '@/lib/team-assignments'
import { isTeamScoped } from '@/lib/scope'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, Building2, CircleOff, ClipboardList, Coffee, ListChecks, Users } from 'lucide-react'
import { STATE_LABEL } from '@/lib/team-assignments-fields'
import { TeamAssignmentBoard } from '@/components/team-assignment/TeamAssignmentBoard'
import { DepartmentSwitcher } from '@/components/team-assignment/DepartmentSwitcher'

export default async function TeamAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; team?: string; state?: string }>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const readUnrestricted = isDepartmentUnrestricted(user) || user.systemRole === 'EXECUTIVE'
  const managedIds = getManagedDepartmentIds(user)

  // Team Leaders get access scoped to the team(s) they actually lead — both
  // VA-type leaders and TEAM_LEADER-SystemRole staff accounts (isTeamScoped).
  // Anyone on that path who leads nothing is sent to /teams instead, same
  // boundary app/resign uses for TL-only actions.
  let ledTeamIds: string[] | null = null
  if (user.userType === 'VIRTUAL_ASSISTANT' || isTeamScoped(user)) {
    ledTeamIds = await getLedTeamIds(user.id)
    if (ledTeamIds.length === 0) redirect('/teams')
  }

  let deptId = params.dept ?? null
  if (!deptId) {
    if (ledTeamIds) {
      const team = await prisma.team.findFirst({ where: { id: { in: ledTeamIds } }, select: { departmentId: true } })
      deptId = team?.departmentId ?? null
    } else {
      deptId = managedIds[0] ?? getPrimaryDepartment(user)?.id ?? null
    }
  }

  if (deptId && !readUnrestricted && !ledTeamIds && !managedIds.includes(deptId)) {
    redirect('/team-assignment')
  }

  let departments: { id: string; name: string }[] = []
  if (readUnrestricted) {
    departments = await cached('team-assignment:departments', [CACHE_TAGS.departments], 600, () =>
      prisma.department.findMany({
        where: { status: 'ACTIVE', parentId: { not: null } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      })
    )
  } else if (ledTeamIds) {
    // Only the departments of the teams they lead (one team → no switcher).
    const ledDepts = await prisma.department.findMany({
      where: { teams: { some: { id: { in: ledTeamIds } } } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    })
    if (ledDepts.length > 1) departments = ledDepts
  } else if (managedIds.length > 1) {
    departments = await prisma.department.findMany({
      where: { id: { in: managedIds } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    })
  }

  const department = deptId
    ? await cached(`team-assignment:department:${deptId}`, [CACHE_TAGS.departments], 600, () =>
        prisma.department.findUnique({ where: { id: deptId! }, select: { id: true, name: true } })
      )
    : null

  const teamFilter = typeof params.team === 'string' ? params.team : undefined
  const stateFilter =
    params.state === 'ACTIVE' || params.state === 'IDLE' || params.state === 'UNAVAILABLE' ? (params.state as VAAssignmentState) : undefined

  return (
    <div data-wide-page className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="h-6 w-6" />
            Team Assignment
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Per-team capacity and VA-to-client assignments{department ? ` — ${department.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ledTeamIds && (
            <Link href="/tmf">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                Team Monitoring
              </Button>
            </Link>
          )}
          {departments.length > 1 && <DepartmentSwitcher departments={departments} value={deptId} />}
        </div>
      </div>

      {!department ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">You&apos;re not assigned to a department yet.</p>
        </div>
      ) : (
        <Suspense fallback={<TeamAssignmentSkeleton />} key={`${department.id}:${teamFilter}:${stateFilter}`}>
          <TeamAssignmentSection
            departmentId={department.id}
            teamFilter={teamFilter}
            stateFilter={stateFilter}
            ledTeamIds={ledTeamIds}
            canManageTeams={TEAM_MANAGE_ROLES.includes(user.systemRole) && (isDepartmentUnrestricted(user) || managedIds.includes(department.id))}
          />
        </Suspense>
      )}
    </div>
  )
}

async function TeamAssignmentSection({
  departmentId,
  teamFilter,
  stateFilter,
  ledTeamIds,
  canManageTeams,
}: {
  departmentId: string
  teamFilter?: string
  stateFilter?: VAAssignmentState
  ledTeamIds: string[] | null
  canManageTeams: boolean
}) {
  const data = await cached(
    `team-assignment:${departmentId}`,
    [CACHE_TAGS.teams, CACHE_TAGS.assignments, CACHE_TAGS.vas],
    60,
    () => getDepartmentTeamAssignments(departmentId)
  )

  const scopedTeams = ledTeamIds ? data.teams.filter((t) => ledTeamIds.includes(t.teamId)) : data.teams
  let teams = scopedTeams
  if (teamFilter) teams = teams.filter((t) => t.teamId === teamFilter)
  if (stateFilter) {
    teams = teams
      .map((t) => ({ ...t, members: t.members.filter((m) => m.state === stateFilter) }))
      .filter((t) => t.members.length > 0)
  }
  // Team-scoped viewers get totals over their own teams only, not the department's.
  const totals = ledTeamIds ? countTeamMembers(scopedTeams) : data.totals
  const unassigned = ledTeamIds || teamFilter
    ? []
    : stateFilter
      ? data.unassigned.filter((m) => m.state === stateFilter)
      : data.unassigned
  const scopedMembers = [...scopedTeams.flatMap((t) => t.members), ...(ledTeamIds ? [] : data.unassigned)]
  const clientsServed = new Set(scopedMembers.flatMap((m) => m.clients.map((c) => c.id))).size
  const agreedHours = scopedMembers.reduce((sum, m) => sum + m.totalAgreedHours, 0)
  // A Team Leader with one team is always looking at just that team — no chip for it.
  const singleTeam = !!ledTeamIds && scopedTeams.length === 1
  const filteredTeamName = teamFilter && !singleTeam ? data.teams.find((t) => t.teamId === teamFilter)?.teamName : undefined

  // State tiles toggle their filter and keep the department/team in the URL.
  const stateHref = (state?: VAAssignmentState) => {
    const params = new URLSearchParams({ dept: departmentId })
    if (teamFilter) params.set('team', teamFilter)
    if (state && state !== stateFilter) params.set('state', state)
    return `/team-assignment?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StateTile icon={Users} label="Total VAs" value={totals.total} href={stateHref()} active={!stateFilter} />
        <StateTile icon={Briefcase} label="Active" value={totals.active} tone="success" href={stateHref('ACTIVE')} active={stateFilter === 'ACTIVE'} />
        <StateTile icon={Coffee} label="Idle (bench)" value={totals.idle} tone="info" href={stateHref('IDLE')} active={stateFilter === 'IDLE'} />
        <StateTile icon={CircleOff} label="Unavailable" value={totals.unavailable} tone="warning" href={stateHref('UNAVAILABLE')} active={stateFilter === 'UNAVAILABLE'} />
        <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">Clients Served</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{clientsServed}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{Math.round(agreedHours * 10) / 10}h agreed</p>
        </div>
      </div>

      {(filteredTeamName || stateFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filtered:</span>
          {filteredTeamName && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 font-medium">{filteredTeamName}</span>
          )}
          {stateFilter && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 font-medium">{STATE_LABEL[stateFilter]}</span>
          )}
          <Link href={`/team-assignment?dept=${departmentId}`} className="text-muted-foreground hover:text-primary transition-colors">
            Clear
          </Link>
        </div>
      )}

      <TeamAssignmentBoard
        teams={teams}
        unassigned={unassigned}
        assignableTeams={canManageTeams ? data.teams.map((t) => ({ id: t.teamId, name: t.teamName })) : []}
        singleTeam={singleTeam}
      />
    </div>
  )
}

const TILE_TONE = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  neutral: 'text-muted-foreground',
} as const

function StateTile({
  icon: Icon,
  label,
  value,
  href,
  active,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  href: string
  active: boolean
  tone?: keyof typeof TILE_TONE
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group/tile card-hover rounded-xl border bg-gradient-to-br from-card to-muted/40 p-4 transition-all',
        active && 'border-primary/50 ring-2 ring-primary/20'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-muted transition-transform group-hover/tile:scale-110', TILE_TONE[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </Link>
  )
}

function TeamAssignmentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  )
}
