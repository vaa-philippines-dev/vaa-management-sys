'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import {
  requireRole,
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  VA_MUTATOR_ROLES,
} from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { AVAILABILITY_REVIEW_DAYS } from '@/lib/va-availability-fields'
import type { Availability } from '@/src/generated/prisma/enums'

async function assertVAInScope(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  vaProfileId: string
) {
  const profile = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { user: { select: { memberships: { where: { endedAt: null }, select: { departmentId: true } } } } },
  })
  if (!profile) throw new Error('VA not found')
  if (!actor || isDepartmentUnrestricted(actor)) return

  const managedIds = getManagedDepartmentIds(actor)
  if (!profile.user.memberships.some((m) => managedIds.includes(m.departmentId))) {
    throw new Error('Forbidden: department not in your managed scope')
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
// departmental view only ever writes these three DMF columns: DMF CHANGE
// AVAILABILITY, DMF REMARKS and DMF DATE CHANGED.
export async function updateAvailability(vaProfileId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertVAInScope(actor, vaProfileId)

  const before = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { availabilityStatus: true, availabilityRemarks: true, availabilityChangedAt: true },
  })
  if (!before) return { error: 'VA not found' }

  const availabilityStatus = (formData.get('availabilityStatus') as Availability) || 'AVAILABLE'
  const availabilityRemarks = ((formData.get('availabilityRemarks') as string) ?? '').trim() || null
  const changedAt = parseDate(formData.get('availabilityChangedAt')) ?? new Date()

  // DMF UPDATE STATUS DATE is auto — always a review window out from
  // whatever DMF DATE CHANGED was just set to, never entered by hand.
  const reviewDueAt = new Date(changedAt.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000)

  await prisma.vAProfile.update({
    where: { id: vaProfileId },
    data: {
      availabilityStatus,
      availabilityRemarks,
      availabilityChangedAt: changedAt,
      availabilityReviewDueAt: reviewDueAt,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    before: {
      availabilityStatus: before.availabilityStatus,
      availabilityRemarks: before.availabilityRemarks,
      availabilityChangedAt: before.availabilityChangedAt?.toISOString() ?? null,
    },
    after: {
      availabilityStatus,
      availabilityRemarks,
      availabilityChangedAt: changedAt.toISOString(),
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
export async function confirmAvailability(vaProfileId: string) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertVAInScope(actor, vaProfileId)

  const now = new Date()
  await prisma.vAProfile.update({
    where: { id: vaProfileId },
    data: {
      availabilityChangedAt: now,
      availabilityReviewDueAt: new Date(now.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000),
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    after: { availabilityConfirmedAt: now.toISOString() },
    metadata: { surface: 'va-availability' },
  })

  revalidatePath('/va-availability')
  revalidateTag(CACHE_TAGS.vas, 'default')
  return { ok: true }
}
