'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { notify } from '@/lib/notifications'
import { computeKpiCheckpoints } from '@/lib/kpi-checks'

export async function createAssignment(formData: FormData) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  const clientId = formData.get('clientId') as string
  const vaProfileId = formData.get('vaProfileId') as string
  const type = formData.get('type') as 'REGULAR' | 'PROJECT'
  const agreedHours = Number(formData.get('agreedHours'))
  const startDate = new Date(formData.get('startDate') as string)
  const endDateRaw = formData.get('endDate') as string | null
  const endDate = endDateRaw && type === 'PROJECT' ? new Date(endDateRaw) : null
  const monthlyHoursRaw = formData.get('monthlyHours') as string | null
  const monthlyHours = type === 'REGULAR' && monthlyHoursRaw ? Number(monthlyHoursRaw) : null
  const notes = (formData.get('notes') as string) || null

  const assignment = await prisma.assignment.create({
    data: {
      clientId,
      vaProfileId,
      type,
      agreedHours,
      startDate,
      endDate,
      monthlyHours,
      notes,
    },
    include: {
      client: { select: { name: true } },
      vaProfile: { select: { userId: true } },
    },
  })

  // Seeds the 7 fixed KPI check-in milestones (Day 4/Week 1/Week 2/Month
  // 1/2/3/6) for this assignment up front — see lib/kpi-checks.ts.
  await prisma.assignmentKpiCheck.createMany({
    data: computeKpiCheckpoints(startDate).map(({ milestone, dueDate }) => ({
      assignmentId: assignment.id,
      milestone,
      dueDate,
    })),
  })

  // Opens the VA Preparation record alongside it. The sheet has one
  // Preparation row per engagement whether or not anyone has filled it in
  // yet, so creating it empty here (rather than lazily on first edit) keeps
  // every assignment visible on /va-preparation from day one instead of
  // only the ones someone happened to touch. targetStartDate seeds from the
  // assignment's own start date — the two only diverge once the engagement
  // actually slips, which is exactly what startStatus then records.
  await prisma.assignmentPreparation.create({
    data: { assignmentId: assignment.id, targetStartDate: startDate },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Assignment',
    entityId: assignment.id,
    after: { clientId, vaProfileId, type, agreedHours, startDate: startDate.toISOString(), endDate: endDate?.toISOString() ?? null, monthlyHours },
  })

  await notify({
    recipientId: assignment.vaProfile.userId,
    type: 'NEW_ASSIGNMENT',
    title: 'New client assignment',
    message: `You've been assigned to ${assignment.client.name}.`,
    entityType: 'Assignment',
    entityId: assignment.id,
  })

  revalidatePath('/assignments')
  revalidateTag(CACHE_TAGS.assignments, 'default')
  redirect(`/assignments/${assignment.id}`)
}

// Reassigning the client or VA isn't exposed here — that's a bigger business
// action (akin to a VA transfer) than fixing a wrong hours/date/notes value,
// so this only ever touches the assignment's own details.
export async function updateAssignment(id: string, formData: FormData) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  const before = await prisma.assignment.findUnique({
    where: { id },
    select: { source: true, type: true, agreedHours: true, monthlyHours: true, startDate: true, endDate: true, notes: true },
  })
  if (!before) throw new Error('Assignment not found')

  // Synced Assignments are owned by the VAConnections sheet import — manual edits
  // here would just get silently overwritten by the next sync run.
  if (before.source === 'VA_CONNECTIONS_SYNC') {
    throw new Error('This assignment is synced from the VAConnections sheet and cannot be edited here.')
  }

  const type = formData.get('type') as 'REGULAR' | 'PROJECT'
  const agreedHours = Number(formData.get('agreedHours'))
  const startDate = new Date(formData.get('startDate') as string)
  const endDateRaw = formData.get('endDate') as string | null
  const endDate = endDateRaw && type === 'PROJECT' ? new Date(endDateRaw) : null
  const monthlyHoursRaw = formData.get('monthlyHours') as string | null
  const monthlyHours = type === 'REGULAR' && monthlyHoursRaw ? Number(monthlyHoursRaw) : null
  const notes = (formData.get('notes') as string) || null

  await prisma.assignment.update({
    where: { id },
    data: { type, agreedHours, startDate, endDate, monthlyHours, notes },
  })

  // Recompute KPI checkpoint due dates when the start date actually changes
  // — but only for checkpoints not yet marked done, so a correction to the
  // start date can't retroactively shift when an already-completed check-in
  // happened.
  if (startDate.getTime() !== before.startDate.getTime()) {
    await Promise.all(
      computeKpiCheckpoints(startDate).map(({ milestone, dueDate }) =>
        prisma.assignmentKpiCheck.updateMany({
          where: { assignmentId: id, milestone, completed: false },
          data: { dueDate },
        })
      )
    )
  }

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Assignment',
    entityId: id,
    before: {
      type: before.type,
      agreedHours: Number(before.agreedHours),
      monthlyHours: before.monthlyHours ? Number(before.monthlyHours) : null,
      startDate: before.startDate.toISOString(),
      endDate: before.endDate?.toISOString() ?? null,
      notes: before.notes,
    },
    after: { type, agreedHours, monthlyHours, startDate: startDate.toISOString(), endDate: endDate?.toISOString() ?? null, notes },
  })

  revalidatePath('/assignments')
  revalidatePath(`/assignments/${id}`)
  revalidateTag(CACHE_TAGS.assignments, 'default')
}

// Marks one KPI check-in milestone done — the sheet's own "ACTION: Reschedule"
// column is just a static call-to-action until this happens, not a real
// per-row state machine, so this is the only mutation the KPI panels need.
export async function completeKpiCheck(checkId: string) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  const check = await prisma.assignmentKpiCheck.update({
    where: { id: checkId },
    data: { completed: true, completedAt: new Date(), completedById: actor.id },
    select: { id: true, milestone: true, assignmentId: true },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentKpiCheck',
    entityId: check.id,
    after: { completed: true, milestone: check.milestone, assignmentId: check.assignmentId },
  })

  revalidatePath('/dashboard')
  revalidateTag(CACHE_TAGS.assignments, 'default')
  revalidateTag(CACHE_TAGS.dashboard, 'default')
}

export async function updateAssignmentStatus(id: string, status: string) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  const before = await prisma.assignment.findUnique({ where: { id }, select: { status: true, source: true } })

  // Synced Assignments are owned by the VAConnections sheet import — manual edits
  // here would just get silently overwritten by the next sync run.
  if (before?.source === 'VA_CONNECTIONS_SYNC') {
    throw new Error('This assignment is synced from the VAConnections sheet and cannot be edited here.')
  }

  await prisma.assignment.update({ where: { id }, data: { status: status as any } })

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'Assignment',
    entityId: id,
    before: before ? { status: before.status } : undefined,
    after: { status },
  })

  revalidatePath('/assignments')
  revalidateTag(CACHE_TAGS.assignments, 'default')
  revalidatePath(`/assignments/${id}`)
  revalidateTag(CACHE_TAGS.assignments, 'default')
}