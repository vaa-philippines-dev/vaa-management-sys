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
import { CHECKLIST_FIELDS, type ChecklistKey } from '@/lib/va-preparation-fields'
import type {
  PreparationStartStatus,
  PreparationStepStatus,
  PreparationClientStatus,
  PreparationVaType,
} from '@/src/generated/prisma/enums'

// Preparation is the staffing pipeline for an engagement, so it's owned by
// whoever can mutate the Assignment underneath it — no separate role tier.
const PREPARATION_MUTATOR_ROLES = ASSIGNMENT_MUTATOR_ROLES

const CHECKLIST_KEYS = CHECKLIST_FIELDS.map((f) => f.key) as readonly ChecklistKey[]

// Every mutation here resolves the preparation's own department from the
// Assignment's client and checks it, so a scoped manager can't reach another
// department's row by id even though the list already filters by department.
async function assertPreparationInScope(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  preparationId: string
) {
  const prep = await prisma.assignmentPreparation.findUnique({
    where: { id: preparationId },
    select: { assignment: { select: { client: { select: { departmentId: true } } } } },
  })
  if (!prep) throw new Error('Preparation record not found')
  if (!actor || isDepartmentUnrestricted(actor)) return

  const departmentId = prep.assignment.client.departmentId
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

function text(formData: FormData, key: string): string | null {
  return ((formData.get(key) as string) ?? '').trim() || null
}

function revalidatePreparation() {
  revalidatePath('/va-preparation')
  revalidatePath('/dashboard')
  revalidateTag(CACHE_TAGS.assignments, 'default')
  revalidateTag(CACHE_TAGS.dashboard, 'default')
}

export async function updatePreparation(preparationId: string, formData: FormData) {
  const actor = await requireRole(...PREPARATION_MUTATOR_ROLES)
  await assertPreparationInScope(actor, preparationId)

  const before = await prisma.assignmentPreparation.findUnique({ where: { id: preparationId } })
  if (!before) return { error: 'Preparation record not found' }

  const clientStatus = (formData.get('clientStatus') as PreparationClientStatus) || 'ACTIVE'
  const effectivityDate = parseDate(formData.get('effectivityDate'))

  // The sheet treats a Paused/End-of-Work row with no effectivity date as an
  // incomplete record and flags it on the dashboard. Refuse it at the source
  // instead of writing the bad row and reporting it back to the same person.
  if (clientStatus !== 'ACTIVE' && !effectivityDate) {
    return { error: 'An effectivity date is required when the status is Paused or End of Work' }
  }

  const data = {
    startStatus: (formData.get('startStatus') as PreparationStartStatus) || 'NOT_YET_STARTED',
    targetStartDate: parseDate(formData.get('targetStartDate')),
    vaType: (formData.get('vaType') as PreparationVaType) || 'NEW',
    scheduleType: text(formData, 'scheduleType'),
    scheduleDays: text(formData, 'scheduleDays'),
    vaBuffers: text(formData, 'vaBuffers'),
    // expertiseGroup/vaClientFileUrl/accountDocUrl are deliberately NOT
    // writable here — the sheet's own column coding marks these "fixed/
    // fetched", not DM/OM-editable (unlike e.g. targetStartDate or
    // vaBuffers, which are genuinely orange/editable there). They're only
    // ever populated by the DMF import; a manager can view but not retype
    // them, same as VA NAME/TEAM/PRIMARY ACCOUNT already are.
    replacementForId: text(formData, 'replacementForId'),
    personInChargeId: text(formData, 'personInChargeId'),
    shadowTrainerId: text(formData, 'shadowTrainerId'),

    clientMeetingDate: parseDate(formData.get('clientMeetingDate')),
    clientMeetingStatus: (formData.get('clientMeetingStatus') as PreparationStepStatus) || 'PENDING',
    preparationStartDate: parseDate(formData.get('preparationStartDate')),
    preparationEndDate: parseDate(formData.get('preparationEndDate')),
    preparationCallDate: parseDate(formData.get('preparationCallDate')),
    preparationCallStatus: (formData.get('preparationCallStatus') as PreparationStepStatus) || 'PENDING',
    mockInterviewDate: parseDate(formData.get('mockInterviewDate')),
    mockInterviewStatus: (formData.get('mockInterviewStatus') as PreparationStepStatus) || 'PENDING',
    vaConnectDate: parseDate(formData.get('vaConnectDate')),
    vaConnectStatus: (formData.get('vaConnectStatus') as PreparationStepStatus) || 'PENDING',

    clientStatus,
    effectivityDate,
    statusReason: text(formData, 'statusReason'),
    replacementNote: text(formData, 'replacementNote'),
    replacedById: text(formData, 'replacedById'),
  }

  await prisma.assignmentPreparation.update({ where: { id: preparationId }, data })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentPreparation',
    entityId: preparationId,
    before: { startStatus: before.startStatus, clientStatus: before.clientStatus, vaConnectStatus: before.vaConnectStatus },
    after: { startStatus: data.startStatus, clientStatus: data.clientStatus, vaConnectStatus: data.vaConnectStatus },
  })

  revalidatePreparation()
  return { ok: true }
}

// The nine onboarding booleans are toggled one at a time straight from the
// table, so they get their own narrow action rather than round-tripping the
// whole edit form for a single checkbox.
export async function toggleChecklistItem(preparationId: string, field: string, value: boolean) {
  const actor = await requireRole(...PREPARATION_MUTATOR_ROLES)
  await assertPreparationInScope(actor, preparationId)

  if (!CHECKLIST_KEYS.includes(field as ChecklistKey)) {
    return { error: 'Unknown checklist item' }
  }

  await prisma.assignmentPreparation.update({
    where: { id: preparationId },
    data: { [field]: value },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentPreparation',
    entityId: preparationId,
    after: { [field]: value },
  })

  revalidatePreparation()
  return { ok: true }
}

// Advancing a pipeline step from the row itself (Client Meeting ->
// Preparation Call -> Mock Interview -> VA Connect), stamping today's date
// when a step is marked done and no date was ever entered for it.
export async function setStepStatus(preparationId: string, step: string, status: PreparationStepStatus) {
  const actor = await requireRole(...PREPARATION_MUTATOR_ROLES)
  await assertPreparationInScope(actor, preparationId)

  const STEP_FIELDS: Record<string, { dateField: string; statusField: string }> = {
    clientMeeting: { dateField: 'clientMeetingDate', statusField: 'clientMeetingStatus' },
    preparationCall: { dateField: 'preparationCallDate', statusField: 'preparationCallStatus' },
    mockInterview: { dateField: 'mockInterviewDate', statusField: 'mockInterviewStatus' },
    vaConnect: { dateField: 'vaConnectDate', statusField: 'vaConnectStatus' },
  }

  const fields = STEP_FIELDS[step]
  if (!fields) return { error: 'Unknown pipeline step' }

  const existing = await prisma.assignmentPreparation.findUnique({
    where: { id: preparationId },
    select: { [fields.dateField]: true },
  })

  const data: Record<string, unknown> = { [fields.statusField]: status }
  if (status === 'DONE' && !(existing as Record<string, unknown> | null)?.[fields.dateField]) {
    data[fields.dateField] = new Date()
  }

  await prisma.assignmentPreparation.update({ where: { id: preparationId }, data })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentPreparation',
    entityId: preparationId,
    after: { step, status },
  })

  revalidatePreparation()
  return { ok: true }
}
