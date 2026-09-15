'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import {
  requireRole,
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  ASSIGNMENT_MUTATOR_ROLES,
} from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { FeedbackWindow, ClientResponseStatus } from '@/src/generated/prisma/enums'

async function assertAssignmentInScope(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  assignmentId: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { client: { select: { departmentId: true } } },
  })
  if (!assignment) throw new Error('Assignment not found')
  if (!actor || isDepartmentUnrestricted(actor)) return

  const departmentId = assignment.client.departmentId
  if (!departmentId || !getManagedDepartmentIds(actor).includes(departmentId)) {
    throw new Error('Forbidden: department not in your managed scope')
  }
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = (value as string | null)?.trim()
  if (!raw) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function revalidatePerformance() {
  revalidatePath('/performance')
  revalidatePath('/dashboard')
  revalidateTag(CACHE_TAGS.assignments, 'default')
  revalidateTag(CACHE_TAGS.dashboard, 'default')
}

// One upsert rather than create-then-update: a window with no row yet is an
// untouched cell, not a missing record, so the first edit is what brings it
// into existence (see emptyCell() in lib/performance.ts).
export async function saveClientFeedback(
  assignmentId: string,
  window: FeedbackWindow,
  formData: FormData
) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)
  await assertAssignmentInScope(actor, assignmentId)

  const requested = formData.get('requested') === 'on'
  const relayedToVa = formData.get('relayedToVa') === 'on'
  const responseStatus = (formData.get('responseStatus') as ClientResponseStatus) || 'NOT_SENT'
  const emailSentAt = parseDate(formData.get('emailSentAt'))
  const receivedAt = parseDate(formData.get('receivedAt'))
  const feedback = ((formData.get('feedback') as string) ?? '').trim() || null

  // "Responded" with nothing recorded loses the actual feedback, which is
  // the only part of this cycle anyone reads later.
  if (responseStatus === 'RESPONDED' && !feedback) {
    return { error: 'Record the feedback itself when the client has responded' }
  }
  // Relaying feedback the VA can't have been given is a bookkeeping error,
  // not a state worth storing.
  if (relayedToVa && responseStatus !== 'RESPONDED') {
    return { error: 'Feedback can only be relayed to the VA once the client has responded' }
  }

  const existing = await prisma.assignmentClientFeedback.findUnique({
    where: { assignmentId_window: { assignmentId, window } },
    select: { id: true, relayedToVa: true, relayedAt: true, responseStatus: true },
  })

  // Stamp the relay date on the transition only, so re-saving the form for
  // an unrelated reason doesn't keep moving "when the VA was told".
  const relayedAt = relayedToVa ? (existing?.relayedToVa ? existing.relayedAt : new Date()) : null

  const data = {
    requested,
    emailSentAt,
    responseStatus,
    receivedAt,
    feedback,
    relayedToVa,
    relayedAt,
  }

  const row = await prisma.assignmentClientFeedback.upsert({
    where: { assignmentId_window: { assignmentId, window } },
    create: { assignmentId, window, ...data },
    update: data,
  })

  await logAudit({
    actorId: actor.id,
    action: existing ? 'UPDATE' : 'CREATE',
    entityType: 'AssignmentClientFeedback',
    entityId: row.id,
    before: existing ? { responseStatus: existing.responseStatus, relayedToVa: existing.relayedToVa } : undefined,
    after: { window, responseStatus, relayedToVa, requested },
  })

  revalidatePerformance()
  return { ok: true }
}

// The KPI grid's own toggle. assignments/actions.ts already has
// completeKpiCheck(), but it only ever marks done — correcting a check-in
// ticked by mistake needs the other direction too.
export async function setKpiCheckCompleted(checkId: string, completed: boolean) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  const check = await prisma.assignmentKpiCheck.findUnique({
    where: { id: checkId },
    select: { assignmentId: true, milestone: true },
  })
  if (!check) return { error: 'Checkpoint not found' }
  await assertAssignmentInScope(actor, check.assignmentId)

  await prisma.assignmentKpiCheck.update({
    where: { id: checkId },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
      completedById: completed ? actor.id : null,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentKpiCheck',
    entityId: checkId,
    after: { completed, milestone: check.milestone, assignmentId: check.assignmentId },
  })

  revalidatePerformance()
  return { ok: true }
}
