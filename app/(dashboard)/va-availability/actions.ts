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

function parseNumber(value: FormDataEntryValue | null): number | null {
  const raw = (value as string | null)?.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = (value as string | null)?.trim()
  if (!raw) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function updateAvailability(vaProfileId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertVAInScope(actor, vaProfileId)

  const before = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: {
      availabilityStatus: true,
      preferredWorkHours: true,
      hybridHours: true,
      isRecommended: true,
      availabilityChangedAt: true,
    },
  })
  if (!before) return { error: 'VA not found' }

  const availabilityStatus = (formData.get('availabilityStatus') as Availability) || 'AVAILABLE'
  const preferredWorkHours = parseNumber(formData.get('preferredWorkHours'))
  const hybridHours = parseNumber(formData.get('hybridHours'))

  if (preferredWorkHours != null && (preferredWorkHours < 0 || preferredWorkHours > 168)) {
    return { error: 'Preferred hours must be between 0 and 168' }
  }
  if (hybridHours != null && hybridHours < 0) {
    return { error: 'Hybrid hours cannot be negative' }
  }

  // The sheet's DMF DATE CHANGED only moves when the availability itself
  // actually changes — touching a remark shouldn't reset the staleness clock
  // and silently clear an overdue flag. The explicit review date wins if the
  // user set one; otherwise it's stamped a review window out, which is what
  // the sheet's DMF UPDATE STATUS DATE is (a month after the change).
  const availabilityChanged =
    availabilityStatus !== before.availabilityStatus ||
    Number(preferredWorkHours ?? 0) !== Number(before.preferredWorkHours ?? 0) ||
    Number(hybridHours ?? 0) !== Number(before.hybridHours ?? 0)

  const changedAt = availabilityChanged ? new Date() : before.availabilityChangedAt
  const explicitReviewDue = parseDate(formData.get('availabilityReviewDueAt'))
  const reviewDueAt =
    explicitReviewDue ??
    (availabilityChanged && changedAt
      ? new Date(changedAt.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000)
      : undefined)

  const isRecommended = formData.get('isRecommended') === 'on'

  await prisma.vAProfile.update({
    where: { id: vaProfileId },
    data: {
      availabilityStatus,
      preferredWorkHours,
      hybridHours,
      isRecommended,
      recommendedForClient: ((formData.get('recommendedForClient') as string) ?? '').trim() || null,
      recommendedUntil: ((formData.get('recommendedUntil') as string) ?? '').trim() || null,
      availabilityRemarks: ((formData.get('availabilityRemarks') as string) ?? '').trim() || null,
      availabilityChangedAt: changedAt,
      ...(reviewDueAt !== undefined ? { availabilityReviewDueAt: reviewDueAt } : {}),
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    before: {
      availabilityStatus: before.availabilityStatus,
      preferredWorkHours: before.preferredWorkHours ? Number(before.preferredWorkHours) : null,
      hybridHours: before.hybridHours ? Number(before.hybridHours) : null,
      isRecommended: before.isRecommended,
    },
    after: { availabilityStatus, preferredWorkHours, hybridHours, isRecommended },
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
