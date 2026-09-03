'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireAuth, hasModuleAccess } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { notify } from '@/lib/notifications'
import { sendEmail, leaveApprovalNeededEmail, leaveRequestDecidedEmail } from '@/lib/email'
import { getActiveApprovalRule, resolveStepApprovers, totalLeaveDays } from '@/lib/leave'
import type { SystemRole } from '@/src/generated/prisma/enums'

const LEAVE_TYPES = ['VACATION', 'SICK', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'UNPAID', 'BEREAVEMENT']
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim()
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

type RuleStep = {
  id: string
  order: number
  resolution: 'DEPARTMENT_HEAD' | 'ROLE' | 'SPECIFIC_USER'
  approverRole: SystemRole | null
  approverUserId: string | null
  requireAll: boolean
}

// Resolves every row at `order`, creates a PENDING LeaveApprovalAction for
// each distinct approver, and notifies them. If a step resolves to nobody
// (e.g. no department head configured), it's skipped rather than blocking
// the request forever — logged so an admin can fix the hierarchy.
async function openStep(
  leaveRequest: { id: string; userId: string; leaveType: string; startDate: Date; endDate: Date; totalDays: unknown },
  steps: RuleStep[],
  order: number
): Promise<'opened' | 'finished'> {
  const rowsAtOrder = steps.filter((s) => s.order === order)

  if (rowsAtOrder.length === 0) {
    await prisma.leaveRequest.update({ where: { id: leaveRequest.id }, data: { status: 'APPROVED' } })
    const requester = await prisma.user.findUnique({ where: { id: leaveRequest.userId } })
    if (requester) {
      await notify({
        recipientId: requester.id,
        type: 'LEAVE_REQUEST_DECIDED',
        title: 'Leave request approved',
        message: `Your ${leaveRequest.leaveType.toLowerCase()} leave request has been fully approved.`,
        entityType: 'LeaveRequest',
        entityId: leaveRequest.id,
      })
      const { subject, html } = leaveRequestDecidedEmail({
        requesterName: fullName(requester),
        status: 'APPROVED',
        leaveType: leaveRequest.leaveType,
        startDate: fmtDate(leaveRequest.startDate),
        endDate: fmtDate(leaveRequest.endDate),
        decidedByName: 'the approval hierarchy',
        note: null,
        viewUrl: `${SITE_URL}/leave`,
      })
      await sendEmail({ to: requester.email, subject, html })
    }
    return 'finished'
  }

  const approverIdSets = await Promise.all(rowsAtOrder.map((row) => resolveStepApprovers(row, leaveRequest.userId)))
  const uniqueApproverIds = [...new Set(approverIdSets.flat())]

  if (uniqueApproverIds.length === 0) {
    console.warn(
      `[Leave] Step ${order} of rule for request ${leaveRequest.id} resolved to zero approvers — skipping to the next step. Check the approval hierarchy configuration (e.g. a department with no head set).`
    )
    return openStep(leaveRequest, steps, order + 1)
  }

  await prisma.leaveRequest.update({ where: { id: leaveRequest.id }, data: { currentStep: order } })
  await prisma.leaveApprovalAction.createMany({
    data: uniqueApproverIds.map((approverId) => ({ leaveRequestId: leaveRequest.id, stepOrder: order, approverId })),
    skipDuplicates: true,
  })

  const approvers = await prisma.user.findMany({ where: { id: { in: uniqueApproverIds } } })
  const requester = await prisma.user.findUnique({ where: { id: leaveRequest.userId } })
  const requesterName = requester ? fullName(requester) : 'A staff member'

  await Promise.all(
    approvers.map(async (approver) => {
      await notify({
        recipientId: approver.id,
        type: 'LEAVE_APPROVAL_NEEDED',
        title: 'Leave approval needed',
        message: `${requesterName} requested ${leaveRequest.leaveType.toLowerCase()} leave and needs your approval.`,
        entityType: 'LeaveRequest',
        entityId: leaveRequest.id,
      })
      const { subject, html } = leaveApprovalNeededEmail({
        approverName: fullName(approver),
        requesterName,
        leaveType: leaveRequest.leaveType,
        startDate: fmtDate(leaveRequest.startDate),
        endDate: fmtDate(leaveRequest.endDate),
        totalDays: String(leaveRequest.totalDays),
        reason: null,
        reviewUrl: `${SITE_URL}/leave/approvals`,
      })
      const sent = await sendEmail({ to: approver.email, subject, html })
      if (sent) {
        await prisma.leaveApprovalAction.updateMany({
          where: { leaveRequestId: leaveRequest.id, approverId: approver.id, stepOrder: order },
          data: { emailSent: true },
        })
      }
    })
  )

  return 'opened'
}

export async function submitLeaveRequest(formData: FormData) {
  const actor = await requireAuth()

  const leaveType = (formData.get('leaveType') as string) || ''
  const startDateStr = (formData.get('startDate') as string) || ''
  const endDateStr = (formData.get('endDate') as string) || ''
  const reason = ((formData.get('reason') as string) ?? '').trim() || null

  if (!LEAVE_TYPES.includes(leaveType)) return { error: 'Invalid leave type' }
  if (!startDateStr || !endDateStr) return { error: 'Start and end dates are required' }

  const startDate = new Date(`${startDateStr}T00:00:00.000Z`)
  const endDate = new Date(`${endDateStr}T00:00:00.000Z`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { error: 'Invalid date' }
  if (endDate.getTime() < startDate.getTime()) return { error: 'End date must be on or after the start date' }

  const totalDays = totalLeaveDays(startDate, endDate)
  if (totalDays <= 0) return { error: 'The selected range has no working days' }

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: actor.id,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  })
  if (overlapping) return { error: 'You already have a pending or approved leave request that overlaps these dates' }

  const rule = await getActiveApprovalRule(actor.systemRole)
  if (!rule || rule.steps.length === 0) {
    return { error: 'No approval hierarchy is configured for your role yet. Contact HR or an admin to set one up.' }
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: actor.id,
      leaveType: leaveType as any,
      startDate,
      endDate,
      totalDays,
      reason,
      ruleId: rule.id,
    },
  })

  await openStep(leaveRequest, rule.steps as RuleStep[], 1)

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'LeaveRequest',
    entityId: leaveRequest.id,
    after: { leaveType, startDate: startDate.toISOString(), endDate: endDate.toISOString(), totalDays, reason },
    // actorId is the VA when submitted via "view as" impersonation (see
    // isViewingAsAccount in lib/auth.ts) — record the real admin here so the
    // audit trail can still tell a test submission from the VA's own.
    metadata: actor.isViewingAsAccount ? { submittedViaViewAsBy: actor.realUserId } : undefined,
  })

  revalidatePath('/leave')
  revalidatePath('/leave/approvals')
  revalidateTag(CACHE_TAGS.leave, 'default')
  return { success: true }
}

export async function cancelLeaveRequest(id: string) {
  const actor = await requireAuth()
  const request = await prisma.leaveRequest.findUnique({ where: { id } })
  if (!request || request.userId !== actor.id) return { error: 'Not found' }
  if (request.status !== 'PENDING') return { error: 'Only pending requests can be cancelled' }

  await prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } })
  await prisma.leaveApprovalAction.updateMany({
    where: { leaveRequestId: id, status: 'PENDING' },
    data: { status: 'CANCELLED', decidedAt: new Date() },
  })

  await logAudit({ actorId: actor.id, action: 'UPDATE', entityType: 'LeaveRequest', entityId: id, after: { status: 'CANCELLED' } })

  revalidatePath('/leave')
  revalidatePath('/leave/approvals')
  revalidateTag(CACHE_TAGS.leave, 'default')
  return { success: true }
}

export async function decideLeaveApprovalAction(actionId: string, decision: 'APPROVE' | 'REJECT', note: string) {
  const actor = await requireAuth()

  const action = await prisma.leaveApprovalAction.findUnique({
    where: { id: actionId },
    include: { leaveRequest: { include: { user: true } } },
  })
  if (!action || action.status !== 'PENDING') return { error: 'This approval is no longer pending' }

  // The actor must be the resolved approver on this row, OR hold an explicit
  // LEAVE-module APPROVER grant — e.g. an admin standing in, or a delegate
  // for an EXECUTIVE approver (who'd otherwise be view-only elsewhere).
  const isNamedApprover = action.approverId === actor.id
  if (!isNamedApprover && !hasModuleAccess(actor, 'leave', 'approve')) {
    return { error: 'You are not authorized to act on this approval' }
  }

  const trimmedNote = note.trim() || null
  const request = action.leaveRequest

  await prisma.leaveApprovalAction.update({
    where: { id: actionId },
    data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', note: trimmedNote, decidedAt: new Date() },
  })

  await logAudit({
    actorId: actor.id,
    action: decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
    entityType: 'LeaveApprovalAction',
    entityId: actionId,
    after: { status: decision, note: trimmedNote },
    metadata: { leaveRequestId: request.id },
  })

  if (decision === 'REJECT') {
    await prisma.leaveRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } })
    await prisma.leaveApprovalAction.updateMany({
      where: { leaveRequestId: request.id, status: 'PENDING' },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    })
    await notify({
      recipientId: request.userId,
      type: 'LEAVE_REQUEST_DECIDED',
      title: 'Leave request rejected',
      message: `${fullName(actor)} rejected your ${request.leaveType.toLowerCase()} leave request.`,
      entityType: 'LeaveRequest',
      entityId: request.id,
    })
    const { subject, html } = leaveRequestDecidedEmail({
      requesterName: fullName(request.user),
      status: 'REJECTED',
      leaveType: request.leaveType,
      startDate: fmtDate(request.startDate),
      endDate: fmtDate(request.endDate),
      decidedByName: fullName(actor),
      note: trimmedNote,
      viewUrl: `${SITE_URL}/leave`,
    })
    await sendEmail({ to: request.user.email, subject, html })
  } else {
    const rule = request.ruleId
      ? await prisma.leaveApprovalRule.findUnique({ where: { id: request.ruleId }, include: { steps: { orderBy: { order: 'asc' } } } })
      : null
    const steps = (rule?.steps ?? []) as RuleStep[]
    const rowsAtStep = steps.filter((s) => s.order === request.currentStep)

    const rowSatisfaction = await Promise.all(
      rowsAtStep.map(async (row) => {
        const candidates = await resolveStepApprovers(row, request.userId)
        if (candidates.length === 0) return true
        const approvedCount = await prisma.leaveApprovalAction.count({
          where: { leaveRequestId: request.id, stepOrder: request.currentStep, approverId: { in: candidates }, status: 'APPROVED' },
        })
        return row.requireAll ? approvedCount >= candidates.length : approvedCount >= 1
      })
    )

    if (rowSatisfaction.every(Boolean)) {
      await prisma.leaveApprovalAction.updateMany({
        where: { leaveRequestId: request.id, stepOrder: request.currentStep, status: 'PENDING' },
        data: { status: 'CANCELLED', decidedAt: new Date() },
      })
      await openStep(request, steps, request.currentStep + 1)
    }
  }

  revalidatePath('/leave')
  revalidatePath('/leave/approvals')
  revalidateTag(CACHE_TAGS.leave, 'default')
  return { success: true }
}
