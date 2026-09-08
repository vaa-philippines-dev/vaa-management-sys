'use server'

import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireAuth } from '@/lib/auth'
import { getLedTeamIds } from '@/lib/teams'
import { createResignationCase } from '@/lib/resignation-case'
import { logAudit } from '@/lib/audit'
import { notifyMany } from '@/lib/notifications'

export async function submitTeamLeaderResignation(formData: FormData) {
  const actor = await requireAuth()

  const ledTeamIds = await getLedTeamIds(actor.id)
  if (ledTeamIds.length === 0) throw new Error('You are not registered as a leader of any active team.')

  const vaProfileId = (formData.get('vaProfileId') as string) || ''
  const assignmentId = (formData.get('assignmentId') as string) || null
  const reason = ((formData.get('reason') as string) || '').trim() || null
  const effectiveDateInput = (formData.get('effectiveDate') as string) || ''
  const recordingLink = ((formData.get('recordingLink') as string) || '').trim() || null

  if (!vaProfileId) throw new Error('Select which VA is resigning.')
  if (!assignmentId) throw new Error('Select the client this VA is resigning from.')
  if (!effectiveDateInput) throw new Error('Enter the effective date (last working day).')
  if (!recordingLink) throw new Error('Enter the resignation call recording link.')
  if (!reason) throw new Error('Enter what you know so far.')

  const effectiveDate = new Date(effectiveDateInput)
  if (Number.isNaN(effectiveDate.getTime())) throw new Error('Invalid effective date.')

  const va = await prisma.vAProfile.findUnique({ where: { id: vaProfileId }, select: { userId: true } })
  if (!va) throw new Error('VA profile not found.')

  const membership = await prisma.teamMembership.findFirst({
    where: { teamId: { in: ledTeamIds }, userId: va.userId, endedAt: null },
  })
  if (!membership) throw new Error('That VA is not on a team you lead.')

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { vaProfileId: true } })
  if (!assignment || assignment.vaProfileId !== vaProfileId) throw new Error('That client is not assigned to this VA.')

  const { terminationId, ticketId } = await createResignationCase({
    actorId: actor.id,
    vaProfileId,
    assignmentId,
    reason,
    effectiveDate,
    recordingLink,
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { vaProfileId, isVoluntaryResignation: true },
    metadata: { ticketId, viaForm: 'team-leader-resignation-report' },
  })

  const hrRecipients = await prisma.user.findMany({
    where: { systemRole: { in: ['HR', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  await notifyMany(
    hrRecipients.map((r) => ({
      recipientId: r.id,
      type: 'RESIGNATION_INTAKE',
      title: 'New resignation reported',
      message: `${actor.firstName || actor.email} reported a resignation.`,
      entityType: 'Termination',
      entityId: terminationId,
    }))
  )

  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')

  redirect('/resign/done')
}
