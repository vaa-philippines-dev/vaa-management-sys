import { prisma } from '@/lib/prisma'
import { workingDaysBetween } from '@/lib/working-days'
import type { SystemRole } from '@/src/generated/prisma/enums'
import type { Prisma } from '@/src/generated/prisma/client'
import type { getCurrentUser } from '@/lib/auth'
import { getViewScope, userScopeWhere } from '@/lib/scope'

type ScopeUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

// workingDaysBetween(from, to) counts days strictly after `from` through `to`
// inclusive (see lib/working-days.ts) — shifting `from` back one calendar day
// makes both the leave's start and end date count, which is what "total days
// of leave" means to a requester.
export function totalLeaveDays(startDate: Date, endDate: Date): number {
  const dayBefore = new Date(startDate)
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
  return workingDaysBetween(dayBefore, endDate)
}

export async function getActiveApprovalRule(submitterRole: SystemRole) {
  return prisma.leaveApprovalRule.findFirst({
    where: { submitterRole, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
}

type ResolvableStep = {
  resolution: 'DEPARTMENT_HEAD' | 'ROLE' | 'SPECIFIC_USER'
  approverRole: SystemRole | null
  approverUserId: string | null
}

// Approver roles that cover the whole company — the same roles lib/scope.ts's
// getViewScope() leaves unscoped. A ROLE step naming one of these resolves to
// every holder; any other role only resolves inside the submitter's own
// departments (see resolveStepApprovers).
const COMPANY_WIDE_APPROVER_ROLES: SystemRole[] = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'HR']

async function activeDepartmentIds(userId: string): Promise<string[]> {
  const memberships = await prisma.departmentMembership.findMany({
    where: { userId, endedAt: null },
    select: { departmentId: true },
  })
  return memberships.map((m) => m.departmentId)
}

// Resolves a step to the concrete set of user ids who must (or may, per
// requireAll) act on it. Department-tier approvers always come from the
// submitter's own department, so a request never lands in another
// department's queue:
//   • SPECIFIC_USER — whoever the hierarchy names (an HR/admin's explicit pick).
//   • DEPARTMENT_HEAD — the head (Department.head) of the submitter's primary
//     department, or of each department they're in when none is primary.
//   • ROLE — HR, Executive and admins company-wide; Dept/Ops Managers and Staff
//     only if they share an active department with the submitter; Team Leaders
//     only if they lead a team the submitter is on (lib/scope.ts's team scope).
//     There's deliberately no company-wide fallback for those any more: it put
//     one department's leave in every Dept Manager's queue. A step that
//     resolves to nobody is skipped by openStep() and logged, so a department
//     with no one in the role needs its hierarchy fixed, not a wider net.
export async function resolveStepApprovers(step: ResolvableStep, submitterId: string): Promise<string[]> {
  switch (step.resolution) {
    case 'SPECIFIC_USER':
      return step.approverUserId ? [step.approverUserId] : []

    case 'ROLE': {
      const role = step.approverRole
      if (!role) return []

      if (COMPANY_WIDE_APPROVER_ROLES.includes(role)) {
        const users = await prisma.user.findMany({ where: { systemRole: role, isActive: true }, select: { id: true } })
        return users.map((u) => u.id)
      }

      const departmentIds = await activeDepartmentIds(submitterId)
      if (departmentIds.length === 0) return []

      if (role === 'TEAM_LEADER') {
        const teams = await prisma.team.findMany({
          where: {
            status: 'ACTIVE',
            departmentId: { in: departmentIds },
            OR: [
              { leaderId: submitterId },
              { tempLeader1Id: submitterId },
              { tempLeader2Id: submitterId },
              { memberships: { some: { userId: submitterId, endedAt: null } } },
            ],
          },
          select: { leaderId: true, tempLeader1Id: true, tempLeader2Id: true },
        })
        const leaderIds = [...new Set(teams.flatMap((t) => [t.leaderId, t.tempLeader1Id, t.tempLeader2Id]))].filter(
          (id): id is string => !!id
        )
        if (leaderIds.length === 0) return []
        const users = await prisma.user.findMany({
          where: { id: { in: leaderIds }, systemRole: 'TEAM_LEADER', isActive: true },
          select: { id: true },
        })
        return users.map((u) => u.id)
      }

      const users = await prisma.user.findMany({
        where: {
          systemRole: role,
          isActive: true,
          memberships: { some: { departmentId: { in: departmentIds }, endedAt: null } },
        },
        select: { id: true },
      })
      return users.map((u) => u.id)
    }

    case 'DEPARTMENT_HEAD': {
      const memberships = await prisma.departmentMembership.findMany({
        where: { userId: submitterId, endedAt: null },
        select: { isPrimary: true, department: { select: { headId: true } } },
      })
      const primary = memberships.filter((m) => m.isPrimary)
      const headIds = (primary.length > 0 ? primary : memberships).map((m) => m.department.headId)
      return [...new Set(headIds)].filter((id): id is string => !!id)
    }

    default:
      return []
  }
}

// Which leave approvals a user may see and act on: the requester has to be in
// their view scope (lib/scope.ts — their departments, or a team-scoped Team
// Leader's own teams), unless the hierarchy names them outright
// (SPECIFIC_USER — an HR/admin's explicit choice, which may cross
// departments). getViewScope rather than getMutateScope: deciding leave is the
// approver's own job, and an Executive named as approver covers the company.
export async function leaveApprovalVisibleWhere(user: ScopeUser): Promise<Prisma.LeaveApprovalActionWhereInput> {
  const scope = await getViewScope(user)
  if (scope === null) return {}
  return {
    OR: [
      { leaveRequest: { user: userScopeWhere(scope) } },
      { leaveRequest: { rule: { steps: { some: { resolution: 'SPECIFIC_USER', approverUserId: user.id } } } } },
    ],
  }
}

// The department view on /leave: leave filed by the people in the viewer's
// scope (their departments, or a Team Leader's teams), excluding their own.
// Staff leave only — VA accounts can't file leave yet. Everything pending,
// plus anything that ended in the last LEAVE_DEPARTMENT_LOOKBACK_DAYS.
export const LEAVE_DEPARTMENT_LOOKBACK_DAYS = 90

export async function getDepartmentLeaveRequests(user: ScopeUser) {
  const scope = await getViewScope(user)
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - LEAVE_DEPARTMENT_LOOKBACK_DAYS)

  const requests = await prisma.leaveRequest.findMany({
    where: {
      userId: { not: user.id },
      user: { userType: { not: 'VIRTUAL_ASSISTANT' }, ...userScopeWhere(scope) },
      OR: [{ status: 'PENDING' }, { endDate: { gte: since } }],
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          systemRole: true,
          memberships: {
            where: { endedAt: null },
            select: { departmentId: true, department: { select: { name: true } } },
          },
        },
      },
      actions: {
        where: { status: 'PENDING' },
        select: { approver: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { startDate: 'desc' },
  })

  return requests.map((r) => ({
    id: r.id,
    requesterName: `${r.user.firstName} ${r.user.lastName}`.trim(),
    requesterRole: r.user.systemRole,
    // Only the departments the viewer can see — someone in two departments
    // shows under the viewer's, not the other one.
    departments: r.user.memberships
      .filter((m) => scope === null || scope.departmentIds.includes(m.departmentId))
      .map((m) => m.department.name),
    leaveType: r.leaveType,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    totalDays: r.totalDays.toString(),
    status: r.status,
    waitingOn: r.actions.map((a) => `${a.approver.firstName} ${a.approver.lastName}`.trim()),
  }))
}
