'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireRole, LEAVE_ADMIN_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { LEAVE_ROLE_OPTIONS, ROLE_LABELS } from '@/lib/leave-roles'

export type StepInput = {
  order: number
  resolution: 'DEPARTMENT_HEAD' | 'ROLE' | 'SPECIFIC_USER'
  approverRole: string | null
  approverUserId: string | null
  requireAll: boolean
}

export async function saveLeaveApprovalRule(submitterRole: string, isActive: boolean, steps: StepInput[]) {
  const actor = await requireRole(...LEAVE_ADMIN_ROLES)

  if (!(LEAVE_ROLE_OPTIONS as readonly string[]).includes(submitterRole)) return { error: 'Invalid role' }
  for (const s of steps) {
    if (!Number.isInteger(s.order) || s.order < 1) return { error: 'Each step needs a step number of 1 or more' }
    if (s.resolution === 'ROLE' && !s.approverRole) return { error: 'Select a role for every "Any user with role" step' }
    if (s.resolution === 'SPECIFIC_USER' && !s.approverUserId) return { error: 'Select a person for every "Specific person" step' }
  }

  const rule = await prisma.leaveApprovalRule.upsert({
    where: { submitterRole: submitterRole as any },
    update: { isActive },
    create: {
      submitterRole: submitterRole as any,
      name: `${ROLE_LABELS[submitterRole] ?? submitterRole} Leave Approval`,
      isActive,
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.leaveApprovalStep.deleteMany({ where: { ruleId: rule.id } })
    if (steps.length > 0) {
      await tx.leaveApprovalStep.createMany({
        data: steps.map((s) => ({
          ruleId: rule.id,
          order: s.order,
          resolution: s.resolution as any,
          approverRole: s.resolution === 'ROLE' ? (s.approverRole as any) : null,
          approverUserId: s.resolution === 'SPECIFIC_USER' ? s.approverUserId : null,
          requireAll: s.requireAll,
        })),
      })
    }
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'LeaveApprovalRule',
    entityId: rule.id,
    after: { submitterRole, isActive, steps },
  })

  revalidatePath('/admin/leave-hierarchy')
  revalidateTag(CACHE_TAGS.leave, 'default')
  return { success: true }
}
