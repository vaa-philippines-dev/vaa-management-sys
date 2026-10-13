'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { notify } from '@/lib/notifications'
import { computeKpiCheckpoints, getDepartmentKpiMilestones, KPI_MILESTONES } from '@/lib/kpi-checks'
import { getMutateScope, assertClientInScope, assertAssignmentInScope, assertVAProfileInScope } from '@/lib/scope'
import { ACTIVE_VA_PROFILE_WHERE } from '@/lib/active-va'
import type { AssignmentStatus } from '@/src/generated/prisma/enums'
import { applyAssignmentStatus } from '@/lib/assignment-status'

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

  // The client decides which department owns the assignment. A scoped manager
  // may also only staff it with a VA who actually belongs to that department —
  // otherwise PPC could pair its own client with an Amazon-only VA. Admins
  // (null scope) skip the membership check so existing cross-dept flows keep working.
  // A Team Leader may staff any client of their teams' departments (a new
  // engagement has no team-member assignment yet, so the team-narrowed client
  // scope would never admit it) — but only with a VA on a team they lead.
  const scope = await getMutateScope(actor)
  await assertClientInScope(scope && { departmentIds: scope.departmentIds, userIds: null }, clientId)
  await assertVAProfileInScope(scope, vaProfileId)
  if (scope !== null) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { departmentId: true } })
    const vaInDept = client?.departmentId
      ? await prisma.vAProfile.count({
          where: {
            id: vaProfileId,
            user: { memberships: { some: { departmentId: client.departmentId, endedAt: null } } },
          },
        })
      : 0
    if (vaInDept === 0) throw new Error("Forbidden: this VA isn't a member of the client's department")
  }

  // Same rule as the form's VA picker — resigned/removed/etc. VAs can't be staffed.
  const vaActive = await prisma.vAProfile.count({ where: { AND: [{ id: vaProfileId }, ACTIVE_VA_PROFILE_WHERE] } })
  if (vaActive === 0) throw new Error('Only active VAs can be assigned')

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
      client: { select: { name: true, departmentId: true } },
      vaProfile: { select: { userId: true } },
    },
  })

  // Seeds the client's department's KPI check-in milestones (by default the
  // sheet's Day 4/Week 1/Week 2/Month 1/2/3/6) up front — see lib/kpi-checks.ts.
  const milestones = await getDepartmentKpiMilestones(assignment.client.departmentId)
  await prisma.assignmentKpiCheck.createMany({
    data: computeKpiCheckpoints(startDate, milestones).map(({ milestone, dueDate }) => ({
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
  await assertAssignmentInScope(await getMutateScope(actor), id)

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
      // Every milestone, not just the department's current schedule: only
      // rows this assignment actually has are matched.
      computeKpiCheckpoints(startDate, KPI_MILESTONES).map(({ milestone, dueDate }) =>
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

// A client asking for more hours on an existing engagement (e.g. "+2 hours").
// The DMF sheet logs these as a separate row with VA TYPE "Additional" and
// its own KPI cycle, so this creates a full Assignment for the same VA and
// client — seeded with KPI check-ins and a Preparation row exactly like
// createAssignment() — linked to the engagement it extends. Hours-derived
// views (VA Availability, TMF, Team Assignment) sum active assignments, so the
// VA's total picks the add-on up without any change there; cancelling the
// request is just cancelling the add-on.
export async function addAdditionalHours(parentId: string, formData: FormData) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)
  await assertAssignmentInScope(await getMutateScope(actor), parentId)

  const target = await prisma.assignment.findUnique({
    where: { id: parentId },
    select: { id: true, parentAssignmentId: true },
  })
  if (!target) throw new Error('Assignment not found')

  // Add-ons never nest: hours added from an add-on's page still attach to the
  // engagement that add-on extends.
  const rootId = target.parentAssignmentId ?? target.id
  const parent = await prisma.assignment.findUnique({
    where: { id: rootId },
    select: {
      id: true,
      status: true,
      source: true,
      type: true,
      endDate: true,
      clientId: true,
      vaProfileId: true,
      client: { select: { name: true, departmentId: true } },
      vaProfile: { select: { userId: true } },
    },
  })
  if (!parent) throw new Error('Assignment not found')
  if (parent.source === 'VA_CONNECTIONS_SYNC') {
    throw new Error('This assignment is synced from the VAConnections sheet and cannot be edited here.')
  }
  if (parent.status !== 'ACTIVE' && parent.status !== 'PAUSED') {
    throw new Error('Additional hours can only be added to an active or paused assignment')
  }

  const hours = Number(formData.get('hours'))
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('Enter how many hours to add')
  const startDateRaw = formData.get('startDate') as string
  if (!startDateRaw) throw new Error('Effective date is required')
  const startDate = new Date(startDateRaw)
  if (Number.isNaN(startDate.getTime())) throw new Error('Effective date is invalid')
  const monthlyHoursRaw = formData.get('monthlyHours') as string | null
  const monthlyHours = parent.type === 'REGULAR' && monthlyHoursRaw ? Number(monthlyHoursRaw) : null
  const notes = ((formData.get('notes') as string) || '').trim() || null

  const vaActive = await prisma.vAProfile.count({ where: { AND: [{ id: parent.vaProfileId }, ACTIVE_VA_PROFILE_WHERE] } })
  if (vaActive === 0) throw new Error('Only active VAs can be assigned')

  const addOn = await prisma.assignment.create({
    data: {
      clientId: parent.clientId,
      vaProfileId: parent.vaProfileId,
      parentAssignmentId: parent.id,
      type: parent.type,
      agreedHours: hours,
      startDate,
      // A project add-on ends with the project it extends.
      endDate: parent.type === 'PROJECT' ? parent.endDate : null,
      monthlyHours,
      notes,
    },
    select: { id: true },
  })

  const milestones = await getDepartmentKpiMilestones(parent.client.departmentId)
  await prisma.assignmentKpiCheck.createMany({
    data: computeKpiCheckpoints(startDate, milestones).map(({ milestone, dueDate }) => ({
      assignmentId: addOn.id,
      milestone,
      dueDate,
    })),
  })

  await prisma.assignmentPreparation.create({
    data: { assignmentId: addOn.id, targetStartDate: startDate, vaType: 'ADDITIONAL' },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Assignment',
    entityId: addOn.id,
    after: {
      parentAssignmentId: parent.id,
      clientId: parent.clientId,
      vaProfileId: parent.vaProfileId,
      type: parent.type,
      agreedHours: hours,
      startDate: startDate.toISOString(),
      monthlyHours,
      notes,
    },
  })

  await notify({
    recipientId: parent.vaProfile.userId,
    type: 'NEW_ASSIGNMENT',
    title: 'Additional hours',
    message: `${parent.client.name} added ${hours} hour${hours === 1 ? '' : 's'} to your assignment.`,
    entityType: 'Assignment',
    entityId: addOn.id,
  })

  revalidatePath('/assignments')
  revalidatePath(`/assignments/${parent.id}`)
  if (target.id !== parent.id) revalidatePath(`/assignments/${target.id}`)
  revalidateTag(CACHE_TAGS.assignments, 'default')
  revalidateTag(CACHE_TAGS.dashboard, 'default')

  return { id: addOn.id }
}

// Marks one KPI check-in milestone done — the sheet's own "ACTION: Reschedule"
// column is just a static call-to-action until this happens, not a real
// per-row state machine, so this is the only mutation the KPI panels need.
export async function completeKpiCheck(checkId: string) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  // Scope follows the check's parent assignment (i.e. its client's department).
  const existing = await prisma.assignmentKpiCheck.findUnique({ where: { id: checkId }, select: { assignmentId: true } })
  if (!existing) throw new Error('KPI check not found')
  await assertAssignmentInScope(await getMutateScope(actor), existing.assignmentId)

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

const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['ACTIVE', 'PAUSED', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

export async function updateAssignmentStatus(id: string, status: string) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)
  await assertAssignmentInScope(await getMutateScope(actor), id)
  if (!ASSIGNMENT_STATUSES.includes(status as AssignmentStatus)) throw new Error('Invalid status')

  const before = await prisma.assignment.findUnique({
    where: { id },
    select: { source: true, parentAssignmentId: true },
  })

  // Synced Assignments are owned by the VAConnections sheet import — manual edits
  // here would just get silently overwritten by the next sync run.
  if (before?.source === 'VA_CONNECTIONS_SYNC') {
    throw new Error('This assignment is synced from the VAConnections sheet and cannot be edited here.')
  }

  // Mirrors onto VA Preparation's VA STATUS WITH CLIENT and ends add-ons
  // with their engagement — see lib/assignment-status.ts.
  await applyAssignmentStatus({ actorId: actor.id, assignmentId: id, status: status as AssignmentStatus })

  revalidatePath('/assignments')
  revalidatePath(`/assignments/${id}`)
  if (before?.parentAssignmentId) revalidatePath(`/assignments/${before.parentAssignmentId}`)
  revalidatePath('/va-preparation')
  revalidatePath('/performance')
  revalidateTag(CACHE_TAGS.assignments, 'default')
  revalidateTag(CACHE_TAGS.dashboard, 'default')
}
