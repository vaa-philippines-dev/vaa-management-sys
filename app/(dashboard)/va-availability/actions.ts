'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import {
  requireRole,
  getCurrentUser,
  VA_MUTATOR_ROLES,
  DMF_RECORD_DELETE_ROLES,
  RECOMMENDATION_MUTATOR_ROLES,
} from '@/lib/auth'
import { getMutateScope, isDepartmentInScope, isUserInScope } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  AVAILABILITY_REVIEW_DAYS,
  RECOMMENDED_NOT_YET_STARTED,
  isAvailability,
  formatRecommendedUntil,
} from '@/lib/va-availability-fields'

// The department is part of the key, not inferred from the VA: a VA in two
// departments has two availability records, and a manager may only touch the
// one for a department they manage — even if they also manage the VA's other
// department, the edit lands on exactly the row they opened.
async function assertVAInScope(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  vaProfileId: string,
  departmentId: string
) {
  const profile = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { userId: true, user: { select: { memberships: { where: { endedAt: null, departmentId }, select: { id: true } } } } },
  })
  if (!profile) throw new Error('VA not found')
  if (profile.user.memberships.length === 0) throw new Error('VA is not in this department')
  if (!actor) return
  const scope = await getMutateScope(actor)
  if (!isDepartmentInScope(scope, departmentId)) {
    throw new Error('Forbidden: department not in your managed scope')
  }
  // A Team Leader may only touch the people on the teams they lead.
  if (!isUserInScope(scope, profile.userId)) {
    throw new Error('Forbidden: VA is not on a team you lead')
  }
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = (value as string | null)?.trim()
  if (!raw) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

// Everything else on this row (preferred/hybrid hours, recommendation,
// contract & employment status, etc.) is sourced from assignments, HR
// records, or — once built — each VA's Team Leader via TMF. The
// departmental view only ever writes these four DMF columns: DMF CHANGE
// AVAILABILITY, DMF REMARKS, DMF DATE CHANGED and DMF UPDATE STATUS DATE.
export async function updateAvailability(vaProfileId: string, departmentId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertVAInScope(actor, vaProfileId, departmentId)

  const before = await prisma.vADepartmentAvailability.findUnique({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    select: { availabilityStatus: true, remarks: true, changedAt: true, reviewDueAt: true },
  })

  const rawStatus = (formData.get('availabilityStatus') as string) || 'AVAILABLE'
  if (!isAvailability(rawStatus)) throw new Error('Invalid availability status')
  const availabilityStatus = rawStatus
  const availabilityRemarks = ((formData.get('availabilityRemarks') as string) ?? '').trim() || null
  const changedAt = parseDate(formData.get('availabilityChangedAt')) ?? new Date()

  // DMF UPDATE STATUS DATE: entered by hand when the manager has a date in
  // mind, otherwise a review window out from DMF DATE CHANGED.
  const reviewDueAt =
    parseDate(formData.get('availabilityReviewDueAt')) ??
    new Date(changedAt.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000)
  if (reviewDueAt < changedAt) throw new Error('The update status due date cannot be before the date changed')

  const data = {
    availabilityStatus,
    remarks: availabilityRemarks,
    changedAt,
    reviewDueAt,
  }
  await prisma.vADepartmentAvailability.upsert({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    create: { vaProfileId, departmentId, ...data },
    update: data,
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    departmentId,
    before: {
      availabilityStatus: before?.availabilityStatus ?? null,
      availabilityRemarks: before?.remarks ?? null,
      availabilityChangedAt: before?.changedAt?.toISOString() ?? null,
      availabilityReviewDueAt: before?.reviewDueAt?.toISOString() ?? null,
    },
    after: {
      availabilityStatus,
      availabilityRemarks,
      availabilityChangedAt: changedAt.toISOString(),
      availabilityReviewDueAt: reviewDueAt.toISOString(),
    },
    metadata: { surface: 'va-availability' },
  })

  revalidatePath('/va-availability')
  revalidatePath('/dashboard')
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidateTag(CACHE_TAGS.dashboard, 'default')
  return { ok: true }
}

// "Still accurate" — the sheet's workflow of re-confirming an availability
// record without changing it, which clears the overdue flag and restarts the
// review window. Separate from updateAvailability() precisely because that
// one must NOT reset the clock on an unrelated edit.
export async function confirmAvailability(vaProfileId: string, departmentId: string) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertVAInScope(actor, vaProfileId, departmentId)

  const now = new Date()
  const data = { changedAt: now, reviewDueAt: new Date(now.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000) }
  await prisma.vADepartmentAvailability.upsert({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    create: { vaProfileId, departmentId, ...data },
    update: data,
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    departmentId,
    after: { availabilityConfirmedAt: now.toISOString() },
    metadata: { surface: 'va-availability' },
  })

  revalidatePath('/va-availability')
  revalidateTag(CACHE_TAGS.vas, 'default')
  return { ok: true }
}

function revalidateAvailability() {
  revalidatePath('/va-availability')
  revalidatePath('/tmf')
  revalidatePath('/dashboard')
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidateTag(CACHE_TAGS.dashboard, 'default')
}

// Admin "delete" for a VA Availability row. Rows are generated from active
// department memberships, so there's nothing to delete outright: this hides
// the (VA, department) row from VA Availability and the TMF, and clears its
// DMF/TMF block so a restored row starts blank. The VA stays a member of the
// department everywhere else.
export async function hideAvailabilityRow(vaProfileId: string, departmentId: string) {
  const actor = await requireRole(...DMF_RECORD_DELETE_ROLES)

  const before = await prisma.vADepartmentAvailability.findUnique({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    select: { availabilityStatus: true, remarks: true, isRecommended: true, tmfAvailabilityStatus: true, tmfRemarks: true },
  })

  const data = {
    hiddenAt: new Date(),
    availabilityStatus: null,
    remarks: null,
    changedAt: null,
    reviewDueAt: null,
    isRecommended: false,
    recommendedForClient: null,
    recommendedUntil: null,
    tmfAvailabilityStatus: null,
    tmfRemarks: null,
    tmfChangedAt: null,
    tmfReviewDueAt: null,
    tmfUpdatedById: null,
  }
  await prisma.vADepartmentAvailability.upsert({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    create: { vaProfileId, departmentId, ...data },
    update: data,
  })

  await logAudit({
    actorId: actor.id,
    action: 'DELETE',
    entityType: 'VADepartmentAvailability',
    entityId: vaProfileId,
    departmentId,
    before: before ?? {},
    metadata: { surface: 'va-availability', hidden: true },
  })

  revalidateAvailability()
  return { ok: true }
}

export async function restoreAvailabilityRow(vaProfileId: string, departmentId: string) {
  const actor = await requireRole(...DMF_RECORD_DELETE_ROLES)

  await prisma.vADepartmentAvailability.update({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    data: { hiddenAt: null },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VADepartmentAvailability',
    entityId: vaProfileId,
    departmentId,
    after: { restored: true },
    metadata: { surface: 'va-availability' },
  })

  revalidateAvailability()
  return { ok: true }
}

// RECOMMENDED / RECOMMENDED FOR / RECOMMENDED UNTIL — the department putting a
// VA forward for a client. Kept apart from updateAvailability() because it's
// a narrower role group, and it doesn't touch DATE CHANGED or restart the
// review window. UNTIL stays text in the sheet's own shape ("Oct 14 2026" or
// "Not yet Started") so imported and in-app values read the same.
export async function updateRecommendation(vaProfileId: string, departmentId: string, formData: FormData) {
  const actor = await requireRole(...RECOMMENDATION_MUTATOR_ROLES)
  await assertVAInScope(actor, vaProfileId, departmentId)

  const before = await prisma.vADepartmentAvailability.findUnique({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    select: { isRecommended: true, recommendedForClient: true, recommendedUntil: true, hiddenAt: true },
  })
  if (before?.hiddenAt) throw new Error('This row was removed from VA Availability; restore it first')

  const isRecommended = formData.get('isRecommended') === 'on'
  const recommendedForClient = ((formData.get('recommendedForClient') as string) ?? '').trim() || null
  const recommendedUntil =
    formData.get('recommendedNotYetStarted') === 'on'
      ? RECOMMENDED_NOT_YET_STARTED
      : formatRecommendedUntil(parseDate(formData.get('recommendedUntil')))
  if (isRecommended && !recommendedForClient) throw new Error('Enter the client this VA is recommended for')

  const data = { isRecommended, recommendedForClient, recommendedUntil }
  await prisma.vADepartmentAvailability.upsert({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    create: { vaProfileId, departmentId, ...data },
    update: data,
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    departmentId,
    before: {
      isRecommended: before?.isRecommended ?? false,
      recommendedForClient: before?.recommendedForClient ?? null,
      recommendedUntil: before?.recommendedUntil ?? null,
    },
    after: data,
    metadata: { surface: 'va-availability' },
  })

  revalidateAvailability()
  return { ok: true }
}
