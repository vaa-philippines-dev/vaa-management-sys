import { prisma } from '@/lib/prisma'
import { workingDaysBetween } from '@/lib/working-days'
import type { SystemRole } from '@/src/generated/prisma/enums'

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

// Resolves a step to the concrete set of user ids who must (or may, per
// requireAll) act on it. DEPARTMENT_HEAD looks up the *submitter's own*
// primary department's head (Department.head) — not "anyone holding
// DEPT_MANAGER" — since that's the only reliable "this person's manager"
// pointer that exists in the schema.
export async function resolveStepApprovers(step: ResolvableStep, submitterId: string): Promise<string[]> {
  switch (step.resolution) {
    case 'SPECIFIC_USER':
      return step.approverUserId ? [step.approverUserId] : []

    // ROLE was resolving to *every* active holder of the role company-wide,
    // so a leave request from one department landed in the approval queue of
    // every Dept Manager in the business. Narrow it to role-holders who share
    // a live department membership with the submitter. Central functions (HR,
    // Executive, Sys Admin) typically aren't members of the requester's
    // department at all, so an empty department-scoped result falls back to
    // the company-wide set rather than silently skipping the step — same
    // "resolve to nobody means skip" hazard openStep() already warns about.
    case 'ROLE': {
      if (!step.approverRole) return []

      const submitterDepartmentIds = (
        await prisma.departmentMembership.findMany({
          where: { userId: submitterId, endedAt: null },
          select: { departmentId: true },
        })
      ).map((m) => m.departmentId)

      if (submitterDepartmentIds.length > 0) {
        const scoped = await prisma.user.findMany({
          where: {
            systemRole: step.approverRole,
            isActive: true,
            memberships: { some: { departmentId: { in: submitterDepartmentIds }, endedAt: null } },
          },
          select: { id: true },
        })
        if (scoped.length > 0) return scoped.map((u) => u.id)
      }

      const users = await prisma.user.findMany({
        where: { systemRole: step.approverRole, isActive: true },
        select: { id: true },
      })
      return users.map((u) => u.id)
    }

    case 'DEPARTMENT_HEAD': {
      const membership = await prisma.departmentMembership.findFirst({
        where: { userId: submitterId, endedAt: null, isPrimary: true },
        select: { department: { select: { headId: true } } },
      })
      const headId = membership?.department.headId
      return headId ? [headId] : []
    }

    default:
      return []
  }
}
