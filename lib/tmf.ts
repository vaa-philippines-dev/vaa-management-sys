import { prisma } from '@/lib/prisma'
import { getCurrentUser, isDepartmentUnrestricted, getManagedDepartmentIds, DEPARTMENT_SCOPED_ROLES } from '@/lib/auth'
import { canViewAllDepartments } from '@/lib/scope'
import { getAvailabilityRows } from '@/lib/va-availability'
import { KPI_MILESTONE_LABELS } from '@/lib/kpi-checks-labels'
import {
  TMF_CHECKIN_LOOKAHEAD_DAYS,
  TMF_LEAVE_LOOKAHEAD_DAYS,
  type TmfData,
  type TmfTeamOption,
} from '@/lib/tmf-fields'

// Prisma reads for the Team Monitoring File (/tmf). See lib/tmf-fields.ts for
// what the TMF is and how it differs from the DMF pages.

type TmfUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

const DAY = 86_400_000
const leadsTeam = (userId: string) => ({
  OR: [{ leaderId: userId }, { tempLeader1Id: userId }, { tempLeader2Id: userId }],
})

// Which teams this user may open in the TMF, and whether they may write it.
//
// Leading a team is what grants the TMF — not a SystemRole. Most team leaders
// are VA accounts (systemRole VA) set as a Team's leader or temp leader, so a
// role check alone would lock out nearly all of them. On top of that, admins/
// HR get every team (editable, for corrections), EXECUTIVE every team
// read-only, and a Dept/Ops Manager their own departments' teams read-only.
// A Team Leader gets only the teams they lead (never their colleagues'), and a
// plain team member gets nothing: the TMF is about the team, kept by its lead.
export async function getTmfTeams(user: TmfUser): Promise<TmfTeamOption[]> {
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'
  const all = !isVA && canViewAllDepartments(user)
  const managedIds = !isVA && !all && DEPARTMENT_SCOPED_ROLES.includes(user.systemRole) ? getManagedDepartmentIds(user) : []

  const teams = await prisma.team.findMany({
    where: {
      status: 'ACTIVE',
      ...(all
        ? {}
        : {
            OR: [
              leadsTeam(user.id),
              ...(managedIds.length > 0 ? [{ departmentId: { in: managedIds } }] : []),
            ],
          }),
    },
    orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      departmentId: true,
      leaderId: true,
      tempLeader1Id: true,
      tempLeader2Id: true,
      department: { select: { name: true } },
    },
  })

  const unrestrictedEditor = !isVA && isDepartmentUnrestricted(user)
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    departmentId: t.departmentId,
    departmentName: t.department.name,
    canEdit: unrestrictedEditor || [t.leaderId, t.tempLeader1Id, t.tempLeader2Id].includes(user.id),
  }))
}

export async function getTmfData(team: TmfTeamOption): Promise<TmfData> {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const teamRow = await prisma.team.findUniqueOrThrow({
    where: { id: team.id },
    select: {
      leader: { select: { firstName: true, lastName: true } },
      tempLeader1: { select: { firstName: true, lastName: true } },
      tempLeader2: { select: { firstName: true, lastName: true } },
      memberships: {
        where: { endedAt: null },
        select: {
          userId: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              memberships: { where: { endedAt: null, departmentId: team.departmentId }, select: { id: true } },
            },
          },
        },
      },
    },
  })

  const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim()
  const leaderNames = [teamRow.leader, teamRow.tempLeader1, teamRow.tempLeader2]
    .filter((u): u is { firstName: string; lastName: string } => !!u)
    .map(fullName)
  const memberIds = [...new Set(teamRow.memberships.map((m) => m.userId))]
  const outsideDepartment = teamRow.memberships
    .filter((m) => m.user.memberships.length === 0)
    .map((m) => fullName(m.user))

  // Every assignment read below is pinned to the team's own department via
  // its client — a member who also works for another department keeps that
  // work out of this team's file.
  const inTeamDept = {
    status: 'ACTIVE' as const,
    vaProfile: { userId: { in: memberIds } },
    client: { departmentId: team.departmentId },
  }

  const [availability, checks, assignments, leaves] = await Promise.all([
    getAvailabilityRows({ departmentIds: [team.departmentId], userIds: memberIds }),
    prisma.assignmentKpiCheck.findMany({
      where: {
        completed: false,
        dueDate: { lte: new Date(today.getTime() + TMF_CHECKIN_LOOKAHEAD_DAYS * DAY) },
        assignment: inTeamDept,
      },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        milestone: true,
        dueDate: true,
        assignment: {
          select: {
            id: true,
            client: { select: { name: true } },
            vaProfile: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: inTeamDept,
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        agreedHours: true,
        startDate: true,
        client: { select: { name: true } },
        vaProfile: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        kpiChecks: { select: { completed: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: memberIds },
        status: { in: ['APPROVED', 'PENDING'] },
        endDate: { gte: today },
        startDate: { lte: new Date(today.getTime() + TMF_LEAVE_LOOKAHEAD_DAYS * DAY) },
      },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        leaveType: true,
        status: true,
        startDate: true,
        endDate: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  const checkIns = checks.map((c) => ({
    id: c.id,
    assignmentId: c.assignment.id,
    vaName: fullName(c.assignment.vaProfile.user),
    vaProfileId: c.assignment.vaProfile.id,
    clientName: c.assignment.client.name,
    milestone: KPI_MILESTONE_LABELS[c.milestone],
    dueDate: c.dueDate.toISOString(),
    overdue: c.dueDate < today,
  }))

  const engagements = assignments.map((a) => ({
    assignmentId: a.id,
    vaName: fullName(a.vaProfile.user),
    vaProfileId: a.vaProfile.id,
    clientName: a.client.name,
    hours: Number(a.agreedHours),
    startDate: a.startDate.toISOString(),
    checksDone: a.kpiChecks.filter((k) => k.completed).length,
    checksTotal: a.kpiChecks.length,
  }))

  const leave = leaves.map((l) => ({
    id: l.id,
    vaName: fullName(l.user),
    leaveType: l.leaveType,
    status: l.status,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    onLeaveToday: l.status === 'APPROVED' && l.startDate <= now && l.endDate >= today,
  }))

  return {
    team: { ...team, leaderNames },
    availability,
    outsideDepartment,
    checkIns,
    engagements,
    leave,
    summary: {
      members: memberIds.length,
      engagements: engagements.length,
      bookedHours: availability.reduce((s, r) => s + r.currentHours, 0),
      freeHours: availability.reduce((s, r) => s + r.availableHours, 0),
      checkInsOverdue: checkIns.filter((c) => c.overdue).length,
      checkInsDueSoon: checkIns.filter((c) => !c.overdue).length,
      tmfNeedsReview: availability.filter((r) => r.tmfAlert !== 'NONE').length,
      mismatches: availability.filter((r) => r.tmfMismatch).length,
      onLeaveToday: new Set(leave.filter((l) => l.onLeaveToday).map((l) => l.vaName)).size,
    },
  }
}
