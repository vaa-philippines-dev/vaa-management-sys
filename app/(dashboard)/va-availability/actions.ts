'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import {
  requireRole,
  getCurrentUser,
  VA_MUTATOR_ROLES,
} from '@/lib/auth'
import { getMutateScope, isDepartmentInScope, isUserInScope } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { AVAILABILITY_REVIEW_DAYS } from '@/lib/va-availability-fields'
import type { Availability } from '@/src/generated/prisma/enums'

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
// departmental view only ever writes these three DMF columns: DMF CHANGE
// AVAILABILITY, DMF REMARKS and DMF DATE CHANGED.
export async function updateAvailability(vaProfileId: string, departmentId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertVAInScope(actor, vaProfileId, departmentId)

  const before = await prisma.vADepartmentAvailability.findUnique({
    where: { vaProfileId_departmentId: { vaProfileId, departmentId } },
    select: { availabilityStatus: true, remarks: true, changedAt: true },
  })

  const availabilityStatus = (formData.get('availabilityStatus') as Availability) || 'AVAILABLE'
  const availabilityRemarks = ((formData.get('availabilityRemarks') as string) ?? '').trim() || null
  const changedAt = parseDate(formData.get('availabilityChangedAt')) ?? new Date()

  // DMF UPDATE STATUS DATE is auto — always a review window out from
  // whatever DMF DATE CHANGED was just set to, never entered by hand.
  const reviewDueAt = new Date(changedAt.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000)

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
