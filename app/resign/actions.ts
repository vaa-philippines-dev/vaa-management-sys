'use server'

// Server Actions in this file are intentionally public — reachable by a Team
// Leader/Dept Manager who has no Supabase session and no account in this
// system at all. See the PUBLIC_TOKEN_ACTIONS exception in
// scripts/check-action-auth.ts. submitResignationIntake does not authenticate
// the caller (there is nothing to authenticate against) — it only creates a
// low-privilege intake record that HR must review and explicitly convert
// before it becomes a real resignation case.

import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { logAudit } from '@/lib/audit'
import { notifyMany } from '@/lib/notifications'
import { nextTerminationTicketNumber } from '@/lib/tickets'
import { getPublicFormActorId } from '@/lib/public-actor'

export async function submitResignationIntake(formData: FormData) {
  const teamLeaderName = ((formData.get('teamLeaderName') as string) || '').trim()
  const teamLeaderEmail = ((formData.get('teamLeaderEmail') as string) || '').trim()
  const vaIdentifier = ((formData.get('vaIdentifier') as string) || '').trim()
  const departmentId = ((formData.get('departmentId') as string) || '').trim() || null
  const reason = ((formData.get('reason') as string) || '').trim() || null

  if (!teamLeaderName || !teamLeaderEmail || !vaIdentifier) {
    throw new Error('Your name, email, and the VA\'s name/employee ID are required.')
  }

  const actorId = await getPublicFormActorId()
  const ticketNumber = await nextTerminationTicketNumber()

  const { intakeId } = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        title: `Resignation Request — ${vaIdentifier}`,
        description: `Submitted by ${teamLeaderName} (${teamLeaderEmail}) via the public resignation request form.${reason ? ` Reason: ${reason}` : ''}`,
        category: 'TERMINATION',
        priority: 'HIGH',
        source: 'INTERNAL',
        createdBy: actorId,
        departmentId,
      },
    })
    const intake = await tx.resignationIntake.create({
      data: {
        ticketId: ticket.id,
        teamLeaderName,
        teamLeaderEmail,
        vaIdentifier,
        departmentId,
        reason,
      },
    })
    return { intakeId: intake.id, ticketId: ticket.id }
  })

  await logAudit({
    actorId,
    action: 'CREATE',
    entityType: 'ResignationIntake',
    entityId: intakeId,
    after: { teamLeaderName, teamLeaderEmail, vaIdentifier, departmentId, reason },
  })

  const hrRecipients = await prisma.user.findMany({
    where: { systemRole: { in: ['HR', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  await notifyMany(
    hrRecipients.map((r) => ({
      recipientId: r.id,
      type: 'RESIGNATION_INTAKE',
      title: 'New resignation request',
      message: `${teamLeaderName} reported a resignation for ${vaIdentifier}.`,
      entityType: 'ResignationIntake',
      entityId: intakeId,
    }))
  )

  revalidatePath('/offboarding')
  revalidateTag(CACHE_TAGS.tickets, 'default')

  redirect('/resign/done')
}
