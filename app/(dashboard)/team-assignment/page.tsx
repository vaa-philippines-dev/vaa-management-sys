import { prisma } from '@/lib/prisma'
import {
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  getPrimaryDepartment,
} from '@/lib/auth'
import { getLedTeamIds } from '@/lib/teams'
import { getDepartmentTeamAssignments, type VAAssignmentState } from '@/lib/team-assignments'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { TeamAssignmentCard } from '@/components/team-assignment/TeamAssignmentCard'
import { UnassignedVAsCard } from '@/components/team-assignment/UnassignedVAsCard'

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

  // Team Leaders (VA-type users in this schema) get access scoped to the
  // team(s) they actually lead — other VA-type users are sent to /teams
  // instead, same boundary app/resign uses for TL-only actions.
  let ledTeamIds: string[] | null = null
  if (user.userType === 'VIRTUAL_ASSISTANT') {
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Assignment</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Per-team capacity and VA-to-client assignments{department ? ` — ${department.name}` : ''}
          </p>
        </div>
        {departments.length > 1 && (
          <form className="flex items-center gap-2">
            <select
              name="dept"
              defaultValue={deptId ?? ''}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted transition-colors">
              Switch
            </button>
          </form>
        )}
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
}: {
  departmentId: string
  teamFilter?: string
  stateFilter?: VAAssignmentState
  ledTeamIds: string[] | null
}) {
  const data = await cached(
    `team-assignment:${departmentId}`,
    [CACHE_TAGS.teams, CACHE_TAGS.assignments, CACHE_TAGS.vas],
    60,
    () => getDepartmentTeamAssignments(departmentId)
  )

  let teams = data.teams
  if (ledTeamIds) teams = teams.filter((t) => ledTeamIds.includes(t.teamId))
  if (teamFilter) teams = teams.filter((t) => t.teamId === teamFilter)
  if (stateFilter) {
    teams = teams
      .map((t) => ({ ...t, members: t.members.filter((m) => m.state === stateFilter) }))
      .filter((t) => t.members.length > 0)
  }
  const unassigned = ledTeamIds
    ? []
    : stateFilter
      ? data.unassigned.filter((m) => m.state === stateFilter)
      : data.unassigned

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-4">
        <SummaryChip label="Total" value={data.totals.total} tone="neutral" />
        <SummaryChip label="Active" value={data.totals.active} tone="success" />
        <SummaryChip label="Idle" value={data.totals.idle} tone="info" />
        <SummaryChip label="Unavailable" value={data.totals.unavailable} tone="warning" />
      </div>

      {teams.length === 0 && unassigned.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No VAs match the current filters.</p>
        </div>
      ) : (
        <>
          {teams.map((team) => (
            <TeamAssignmentCard key={team.teamId} team={team} />
          ))}
          {!ledTeamIds && unassigned.length > 0 && <UnassignedVAsCard members={unassigned} />}
        </>
      )}
    </div>
  )
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'info' | 'neutral' }) {
  return (
    <div className="flex items-center gap-2">
      <StatusIndicator tone={tone}>{label}</StatusIndicator>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  )
}

function TeamAssignmentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  )
}
