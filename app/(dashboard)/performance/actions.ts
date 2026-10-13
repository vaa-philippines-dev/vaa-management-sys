'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireRole, getCurrentUser, ASSIGNMENT_MUTATOR_ROLES, KPI_SCHEDULE_ROLES } from '@/lib/auth'
import { getMutateScope, assertAssignmentInScope as assertInScope, assertDepartmentInScope } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { computeKpiCheckpoints } from '@/lib/kpi-checks'
import { KPI_MILESTONES, resolveKpiMilestones } from '@/lib/kpi-checks-labels'
import type { FeedbackWindow, ClientResponseStatus, KpiMilestone } from '@/src/generated/prisma/enums'

async function assertAssignmentInScope(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  assignmentId: string
) {
  const exists = await prisma.assignment.count({ where: { id: assignmentId } })
  if (exists === 0) throw new Error('Assignment not found')
  // Team Leaders only reach their own teams' members' engagements.
  await assertInScope(await getMutateScope(actor), assignmentId)
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

// The KPI grid's own toggle, driven by the check-in modal. assignments/
// actions.ts already has completeKpiCheck(), but it only ever stamps
// "now" — this one takes a caller-chosen date instead, so a check-in done
// yesterday (or backfilled from a paper note) doesn't get recorded as
// happening at the moment someone got around to ticking it, and so a
// check-in completed after its own due date can be flagged late rather
// than blending in with the ones done on time.
export async function setKpiCheckCompleted(checkId: string, formData: FormData) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  const check = await prisma.assignmentKpiCheck.findUnique({
    where: { id: checkId },
    select: { assignmentId: true, milestone: true, dueDate: true, completed: true, completedAt: true, notes: true },
  })
  if (!check) return { error: 'Checkpoint not found' }
  await assertAssignmentInScope(actor, check.assignmentId)

  const completed = formData.get('completed') === 'on'
  const notes = ((formData.get('notes') as string) ?? '').trim() || null
  let completedAt: Date | null = null
  if (completed) {
    completedAt = parseDate(formData.get('completedAt')) ?? new Date()
    if (completedAt.getTime() > Date.now()) {
      return { error: 'Check-in date cannot be in the future' }
    }
  }

  await prisma.assignmentKpiCheck.update({
    where: { id: checkId },
    data: {
      completed,
      completedAt,
      completedById: completed ? actor.id : null,
      notes,
    },
  })

  const late = completed && completedAt !== null && completedAt > check.dueDate

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentKpiCheck',
    entityId: checkId,
    before: { completed: check.completed, completedAt: check.completedAt, notes: check.notes },
    after: { completed, completedAt, notes, milestone: check.milestone, assignmentId: check.assignmentId, late },
  })

  revalidatePerformance()
  return { ok: true, late }
}

// A department's KPI check-in schedule (FB-0015 — e.g. EA's Day 1 call).
// New engagements are seeded from it (getDepartmentKpiMilestones). Running
// engagements are brought in line only going forward: a milestone added
// here is created where it's still ahead of them, and one removed is dropped
// where it's still ahead and untouched. Nothing already due is fabricated or
// erased — a Day 1 call added today doesn't make every live engagement
// overdue, and a check-in someone already took notes on stays.
export async function updateKpiSchedule(departmentId: string, milestones: string[]) {
  const actor = await requireRole(...KPI_SCHEDULE_ROLES)
  assertDepartmentInScope(await getMutateScope(actor), departmentId)

  const selected = KPI_MILESTONES.filter((m) => milestones.includes(m))
  if (selected.length === 0) return { error: 'Pick at least one check-in' }

  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { kpiMilestones: true } })
  if (!dept) return { error: 'Department not found' }
  const previous = resolveKpiMilestones(dept.kpiMilestones)
  const added = selected.filter((m) => !previous.includes(m))
  const removed = previous.filter((m) => !selected.includes(m))

  await prisma.department.update({ where: { id: departmentId }, data: { kpiMilestones: selected } })

  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
  const running = { status: { in: ['ACTIVE', 'PAUSED'] as ('ACTIVE' | 'PAUSED')[] }, client: { departmentId } }

  let createdChecks = 0
  if (added.length > 0) {
    const assignments = await prisma.assignment.findMany({ where: running, select: { id: true, startDate: true } })
    const data = assignments.flatMap((a) =>
      computeKpiCheckpoints(a.startDate, added)
        .filter((c) => c.dueDate >= today)
        .map((c) => ({ assignmentId: a.id, milestone: c.milestone as KpiMilestone, dueDate: c.dueDate }))
    )
    if (data.length > 0) {
      createdChecks = (await prisma.assignmentKpiCheck.createMany({ data, skipDuplicates: true })).count
    }
  }

  let removedChecks = 0
  if (removed.length > 0) {
    removedChecks = (
      await prisma.assignmentKpiCheck.deleteMany({
        where: {
          milestone: { in: removed },
          completed: false,
          notes: null,
          dueDate: { gte: today },
          assignment: running,
        },
      })
    ).count
  }

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Department',
    entityId: departmentId,
    departmentId,
    before: { kpiMilestones: previous },
    after: { kpiMilestones: selected, createdChecks, removedChecks },
  })

  revalidatePerformance()
  revalidatePath('/tmf')
  return { ok: true, createdChecks, removedChecks }
}
