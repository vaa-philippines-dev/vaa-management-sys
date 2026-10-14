import { prisma } from '@/lib/prisma'
import { getDepartmentTeamAssignments, countTeamMembers } from '@/lib/team-assignments'
import { ENDED_VA_STATUSES } from '@/lib/active-va'

// The manager-facing /teams overview: per team, how its people are deployed
// (built on the same Active/Idle/Unavailable rule as Team Assignment) and
// what needs the manager's attention — overdue KPI check-ins, people who left
// VAA but were never taken off the roster, a team with no leader.
// Client components import the types only.

export type TeamOverview = {
  id: string
  name: string
  departmentName: string
  leaderName: string | null
  tempLeaderNames: string[]
  memberNames: string[]
  members: number
  active: number
  idle: number
  unavailable: number
  clients: number
  hours: number
  overdueCheckIns: number
  leftVaa: number
}

export type TeamsOverviewTotals = {
  teams: number
  members: number
  active: number
  idle: number
  unavailable: number
  notOnTeam: number
  overdueCheckIns: number
}

export const OVERDUE_WINDOW_DAYS = 30

const fullName = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : null)

// `departmentIds` null = every department with an active team (admins/HR).
export async function getTeamsOverview(
  departmentIds: string[] | null
): Promise<{ teams: TeamOverview[]; totals: TeamsOverviewTotals }> {
  const deptIds =
    departmentIds ??
    [...new Set((await prisma.team.findMany({ where: { status: 'ACTIVE' }, select: { departmentId: true } })).map((t) => t.departmentId))]

  const [departments, perDept, overdue, leftVaa] = await Promise.all([
    prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }),
    Promise.all(deptIds.map(async (id) => ({ departmentId: id, data: await getDepartmentTeamAssignments(id) }))),
    // Open check-ins on running engagements that came due in the last
    // OVERDUE_WINDOW_DAYS. The full backlog is mostly imported DMF history
    // (as of Oct 2026: ~1,100 of ~1,300 overdue are over 90 days old), which
    // would flag every team; the whole list stays on /performance. An
    // assignment belongs to its client's department, so a shared VA only
    // counts where the work is.
    prisma.assignmentKpiCheck.findMany({
      where: {
        completed: false,
        dueDate: { lt: new Date(), gte: new Date(Date.now() - OVERDUE_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
        assignment: { status: 'ACTIVE', client: { departmentId: { in: deptIds } } },
      },
      select: { assignment: { select: { vaProfileId: true, endDate: true, client: { select: { departmentId: true } } } }, dueDate: true },
    }),
    // Members who left VAA but whose team membership was never closed out —
    // the team page flags these for removal ("Left VAA").
    prisma.teamMembership.groupBy({
      by: ['teamId'],
      where: {
        endedAt: null,
        team: { departmentId: { in: deptIds }, status: 'ACTIVE' },
        user: { vaProfile: { is: { status: { in: ENDED_VA_STATUSES } } } },
      },
      _count: { _all: true },
    }),
  ])

  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  const leftByTeam = new Map(leftVaa.map((r) => [r.teamId, r._count._all]))
  const overdueByVa = new Map<string, number>()
  for (const c of overdue) {
    // A check the engagement ended before reaching is moot (getDepartmentKpiChecks' rule).
    if (c.assignment.endDate && c.assignment.endDate < c.dueDate) continue
    const key = `${c.assignment.client.departmentId}:${c.assignment.vaProfileId}`
    overdueByVa.set(key, (overdueByVa.get(key) ?? 0) + 1)
  }

  const teams: TeamOverview[] = []
  const allSummaries = []
  let notOnTeam = 0
  let overdueTotal = 0
  const countedVas = new Set<string>()
  for (const { departmentId, data } of perDept) {
    notOnTeam += data.unassigned.length
    allSummaries.push(...data.teams)
    for (const t of data.teams) {
      const clientIds = new Set<string>()
      let hours = 0
      let overdueCheckIns = 0
      for (const m of t.members) {
        for (const c of m.clients) clientIds.add(c.id)
        hours += m.totalAgreedHours
        if (!m.vaProfileId) continue
        const key = `${departmentId}:${m.vaProfileId}`
        const n = overdueByVa.get(key) ?? 0
        overdueCheckIns += n
        if (!countedVas.has(key)) {
          countedVas.add(key)
          overdueTotal += n
        }
      }
      teams.push({
        id: t.teamId,
        name: t.teamName,
        departmentName: deptName.get(departmentId) ?? 'Unknown',
        leaderName: fullName(t.leader),
        tempLeaderNames: [t.tempLeader1, t.tempLeader2].map(fullName).filter((n): n is string => !!n),
        memberNames: t.members.map((m) => m.name),
        members: t.counts.total,
        active: t.counts.active,
        idle: t.counts.idle,
        unavailable: t.counts.unavailable,
        clients: clientIds.size,
        hours,
        overdueCheckIns,
        leftVaa: leftByTeam.get(t.teamId) ?? 0,
      })
    }
  }

  // Each person once, even if they sit on two teams.
  const counts = countTeamMembers(allSummaries)
  return {
    teams,
    totals: {
      teams: teams.length,
      members: counts.total,
      active: counts.active,
      idle: counts.idle,
      unavailable: counts.unavailable,
      notOnTeam,
      overdueCheckIns: overdueTotal,
    },
  }
}

