'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

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
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Assignment',
    entityId: assignment.id,
    after: { clientId, vaProfileId, type, agreedHours, startDate: startDate.toISOString(), endDate: endDate?.toISOString() ?? null, monthlyHours },
  })

  revalidatePath('/assignments')
  revalidateTag(CACHE_TAGS.assignments, 'default')
  redirect(`/assignments/${assignment.id}`)
}

export async function updateAssignmentStatus(id: string, status: string) {
  const actor = await requireRole(...ASSIGNMENT_MUTATOR_ROLES)

  const before = await prisma.assignment.findUnique({ where: { id }, select: { status: true } })

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