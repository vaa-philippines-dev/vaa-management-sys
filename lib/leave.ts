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

    case 'ROLE': {
      if (!step.approverRole) return []
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
