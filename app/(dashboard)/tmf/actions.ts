'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth, isDepartmentUnrestricted } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { AVAILABILITY_REVIEW_DAYS } from '@/lib/va-availability-fields'
import type { Availability } from '@/src/generated/prisma/enums'

const AVAILABILITY_VALUES: Availability[] = ['AVAILABLE', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED', 'ON_LEAVE', 'UNAVAILABLE']

// The TMF block belongs to the team's leadership. Leading the team is the
// grant (most leaders are VA accounts, so no role check would do); admins/HR
// may also write it to correct mistakes. Dept/Ops Managers deliberately
// can't — they read the TMF, and keep their own view in the DMF block via
// /va-availability. The VA must be a current member of this exact team, and
// the row written is the one for the team's department, so a VA who is also
// in another department's team keeps a separate TMF record there.
async function resolveTmfTarget(
  actor: Awaited<ReturnType<typeof requireAuth>>,
  teamId: string,
  vaProfileId: string
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { departmentId: true, status: true, leaderId: true, tempLeader1Id: true, tempLeader2Id: true },
  })
  if (!team || team.status !== 'ACTIVE') throw new Error('Team not found')

  const leads = [team.leaderId, team.tempLeader1Id, team.tempLeader2Id].includes(actor.id)
  const elevated = actor.userType !== 'VIRTUAL_ASSISTANT' && isDepartmentUnrestricted(actor)
  if (!leads && !elevated) throw new Error('Forbidden: only this team\'s leaders can update its TMF')

  const profile = await prisma.vAProfile.findUnique({ where: { id: vaProfileId }, select: { userId: true } })
  if (!profile) throw new Error('VA not found')
  const member = await prisma.teamMembership.count({ where: { teamId, userId: profile.userId, endedAt: null } })
  if (member === 0) throw new Error('This VA is not on this team')

  return team.departmentId
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = (value as string | null)?.trim()
  if (!raw) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

// TMF CHANGE AVAILABILITY / TMF REMARKS / TMF DATE CHANGED. TMF UPDATE
// STATUS DATE is derived, a review window out from the date changed — same
// rule the DMF block uses.
export async function updateTmfAvailability(teamId: string, vaProfileId: string, formData: FormData) {
  const actor = await requireAuth()
  const departmentId = await resolveTmfTarget(actor, teamId, vaProfileId)

  const rawStatus = formData.get('tmfAvailabilityStatus') as Availability
  if (!AVAILABILITY_VALUES.includes(rawStatus)) throw new Error('Invalid availability')
  const tmfRemarks = ((formData.get('tmfRemarks') as string) ?? '').trim() || null
  const tmfChangedAt = parseDate(formData.get('tmfChangedAt')) ?? new Date()
  const tmfReviewDueAt = new Date(tmfChangedAt.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000)

  const key = { vaProfileId_departmentId: { vaProfileId, departmentId } }
  const before = await prisma.vADepartmentAvailability.findUnique({
    where: key,
    select: { tmfAvailabilityStatus: true, tmfRemarks: true, tmfChangedAt: true },
  })

  const data = {
    tmfAvailabilityStatus: rawStatus,
    tmfRemarks,
    tmfChangedAt,
    tmfReviewDueAt,
    tmfUpdatedById: actor.id,
  }
  await prisma.vADepartmentAvailability.upsert({
    where: key,
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
      tmfAvailabilityStatus: before?.tmfAvailabilityStatus ?? null,
      tmfRemarks: before?.tmfRemarks ?? null,
      tmfChangedAt: before?.tmfChangedAt?.toISOString() ?? null,
    },
    after: { tmfAvailabilityStatus: rawStatus, tmfRemarks, tmfChangedAt: tmfChangedAt.toISOString() },
    metadata: { surface: 'tmf', teamId },
  })

  revalidatePath('/tmf')
  revalidatePath('/va-availability')
  return { ok: true }
}

// "Still accurate" — restarts the TMF review clock without changing the
// record, mirroring confirmAvailability() on the DMF side.
export async function confirmTmfAvailability(teamId: string, vaProfileId: string) {
  const actor = await requireAuth()
  const departmentId = await resolveTmfTarget(actor, teamId, vaProfileId)

  const now = new Date()
  const data = {
    tmfChangedAt: now,
    tmfReviewDueAt: new Date(now.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000),
    tmfUpdatedById: actor.id,
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
    after: { tmfConfirmedAt: now.toISOString() },
    metadata: { surface: 'tmf', teamId },
  })

  revalidatePath('/tmf')
  revalidatePath('/va-availability')
  return { ok: true }
}
