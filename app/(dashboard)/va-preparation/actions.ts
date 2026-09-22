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
import { CHECKLIST_FIELDS } from '@/lib/va-preparation-fields'
import type { PreparationStepStatus, PreparationClientStatus } from '@/src/generated/prisma/enums'

// Preparation is the staffing pipeline for an engagement, so it's owned by
// whoever can mutate the Assignment underneath it — no separate role tier.
const PREPARATION_MUTATOR_ROLES = ASSIGNMENT_MUTATOR_ROLES

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
    // startStatus/targetStartDate/vaType/expertiseGroup/vaClientFileUrl/
    // accountDocUrl are deliberately NOT writable here — the sheet's own
    // column coding marks these "fixed/fetched", not DM/OM-editable (unlike
    // e.g. scheduleType/scheduleDays/vaBuffers, which are genuinely orange/
    // editable there). They're only ever populated by the DMF import; a
    // manager can view but not retype them, same as VA NAME/TEAM/PRIMARY
    // ACCOUNT already are.
    scheduleType: text(formData, 'scheduleType'),
    scheduleDays: text(formData, 'scheduleDays'),
    vaBuffers: text(formData, 'vaBuffers'),
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

    // The nine onboarding booleans now save together with the rest of the
    // form instead of toggling one at a time straight from the table.
    ...Object.fromEntries(CHECKLIST_FIELDS.map((f) => [f.key, formData.has(f.key)])),
  }

  await prisma.assignmentPreparation.update({ where: { id: preparationId }, data })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentPreparation',
    entityId: preparationId,
    before: { clientStatus: before.clientStatus, vaConnectStatus: before.vaConnectStatus },
    after: { clientStatus: data.clientStatus, vaConnectStatus: data.vaConnectStatus },
  })

  revalidatePreparation()
  return { ok: true }
}
