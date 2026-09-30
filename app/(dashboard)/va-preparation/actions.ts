'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import {
  requireRole,
  getCurrentUser,
  ASSIGNMENT_MUTATOR_ROLES,
} from '@/lib/auth'
import { getMutateScope, assertAssignmentInScope } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { CHECKLIST_FIELDS, CLIENT_STATUS_LABELS, requiresEffectivityDate, resolveClientStatus } from '@/lib/va-preparation-fields'
import { ACTIVE_VA_PROFILE_WHERE, ACTIVE_VA_USER_WHERE } from '@/lib/active-va'
import { teamLeaderUserWhere } from '@/lib/teams'
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
    select: { assignmentId: true },
  })
  if (!prep) throw new Error('Preparation record not found')
  // Team Leaders only reach their own teams' members' engagements.
  await assertAssignmentInScope(await getMutateScope(actor), prep.assignmentId)
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

  const rawClientStatus = (formData.get('clientStatus') as string) || ''
  if (rawClientStatus && !(rawClientStatus in CLIENT_STATUS_LABELS)) {
    return { error: 'Invalid VA status with client' }
  }
  const vaConnectStatus = (formData.get('vaConnectStatus') as PreparationStepStatus) || 'PENDING'
  const vaConnectDate = parseDate(formData.get('vaConnectDate'))
  // Blank until VA Connect is Done, then Active effective the VA Connect
  // date (today when none was entered) — see resolveClientStatus().
  const { clientStatus, effectivityDate } = resolveClientStatus({
    clientStatus: (rawClientStatus || null) as PreparationClientStatus | null,
    effectivityDate: parseDate(formData.get('effectivityDate')),
    vaConnectStatus,
    vaConnectDate,
    fallbackDate: parseDate(new Date().toISOString().slice(0, 10)),
  })

  // The sheet treats a Paused/End-of-Work/Cancelled row with no effectivity
  // date as an incomplete record and flags it on the dashboard. Refuse it at
  // the source instead of writing the bad row and reporting it back to the
  // same person.
  if (requiresEffectivityDate(clientStatus) && !effectivityDate) {
    return { error: 'An effectivity date is required when the status is Paused, End of Work or Cancelled' }
  }

  // The pickers only offer Team Leaders (person in-charge) and active VAs
  // (shadow trainer, buffers); hold the server to the same lists. A value the
  // record already had is kept even if that person no longer qualifies, so
  // saving an unrelated field never fails on history.
  const personInChargeId = text(formData, 'personInChargeId')
  const shadowTrainerId = text(formData, 'shadowTrainerId')
  const bufferIds = [...new Set(formData.getAll('bufferVaProfileIds').map((v) => String(v).trim()).filter(Boolean))]
  const existingBufferIds = (
    await prisma.assignmentPreparationBuffer.findMany({ where: { preparationId }, select: { vaProfileId: true } })
  ).map((b) => b.vaProfileId)

  if (personInChargeId && personInChargeId !== before.personInChargeId) {
    const ok = await prisma.user.count({ where: { AND: [{ id: personInChargeId }, teamLeaderUserWhere(null)] } })
    if (!ok) return { error: 'Person in-charge must be a Team Leader' }
  }
  if (shadowTrainerId && shadowTrainerId !== before.shadowTrainerId) {
    const ok = await prisma.user.count({ where: { AND: [{ id: shadowTrainerId }, ACTIVE_VA_USER_WHERE] } })
    if (!ok) return { error: 'Shadow trainer must be an active VA' }
  }
  const newBufferIds = bufferIds.filter((id) => !existingBufferIds.includes(id))
  if (newBufferIds.length > 0) {
    const ok = await prisma.vAProfile.count({ where: { AND: [{ id: { in: newBufferIds } }, ACTIVE_VA_PROFILE_WHERE] } })
    if (ok !== newBufferIds.length) return { error: 'VA buffers must be active VAs' }
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
    // vaBuffers (legacy text) is only ever cleared here, once a manager
    // dismisses it — buffers are picked from the VA list instead.
    vaBuffers: formData.get('clearLegacyBuffers') ? null : before.vaBuffers,
    replacementForId: text(formData, 'replacementForId'),
    personInChargeId,
    shadowTrainerId,

    clientMeetingDate: parseDate(formData.get('clientMeetingDate')),
    clientMeetingStatus: (formData.get('clientMeetingStatus') as PreparationStepStatus) || 'PENDING',
    preparationStartDate: parseDate(formData.get('preparationStartDate')),
    preparationEndDate: parseDate(formData.get('preparationEndDate')),
    preparationCallDate: parseDate(formData.get('preparationCallDate')),
    preparationCallStatus: (formData.get('preparationCallStatus') as PreparationStepStatus) || 'PENDING',
    mockInterviewDate: parseDate(formData.get('mockInterviewDate')),
    mockInterviewStatus: (formData.get('mockInterviewStatus') as PreparationStepStatus) || 'PENDING',
    vaConnectDate,
    vaConnectStatus,

    clientStatus,
    effectivityDate,
    statusReason: text(formData, 'statusReason'),
    replacementNote: text(formData, 'replacementNote'),
    replacedById: text(formData, 'replacedById'),

    // The nine onboarding booleans now save together with the rest of the
    // form instead of toggling one at a time straight from the table.
    ...Object.fromEntries(CHECKLIST_FIELDS.map((f) => [f.key, formData.has(f.key)])),
  }

  await prisma.$transaction([
    prisma.assignmentPreparation.update({ where: { id: preparationId }, data }),
    prisma.assignmentPreparationBuffer.deleteMany({ where: { preparationId } }),
    prisma.assignmentPreparationBuffer.createMany({
      data: bufferIds.map((vaProfileId, sortOrder) => ({ preparationId, vaProfileId, sortOrder })),
    }),
  ])

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'AssignmentPreparation',
    entityId: preparationId,
    before: { clientStatus: before.clientStatus, vaConnectStatus: before.vaConnectStatus, bufferIds: existingBufferIds },
    after: { clientStatus: data.clientStatus, vaConnectStatus: data.vaConnectStatus, bufferIds },
  })

  revalidatePreparation()
  return { ok: true }
}
