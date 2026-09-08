import { prisma } from '@/lib/prisma'
import { nextTerminationTicketNumber } from '@/lib/tickets'
import type { TerminationType } from '@/src/generated/prisma/enums'

// Shared by initiateResignation() (HR/manager-triggered, inside the
// dashboard) and submitTeamLeaderResignation() (app/resign, triggered by a
// team's own leader) — both create the Ticket + Termination together so the
// case is never orphaned (see the ticket-creation-timing fix history on
// initiateResignation).
export async function createResignationCase({
  actorId,
  vaProfileId,
  assignmentId,
  reason,
  effectiveDate,
  recordingLink,
}: {
  actorId: string
  vaProfileId: string
  assignmentId?: string | null
  reason: string | null
  // FB-0005: when reported by a Team Leader via /resign, the last working day
  // and the resignation-call recording are captured immediately at filing time
  // rather than left for a later discussion step.
  effectiveDate?: Date
  recordingLink?: string | null
}): Promise<{ terminationId: string; ticketId: string }> {
  const va = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: {
      id: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          memberships: { where: { isPrimary: true, endedAt: null }, select: { departmentId: true } },
        },
      },
    },
  })
  if (!va) throw new Error('VA profile not found')

  if (assignmentId) {
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { vaProfileId: true } })
    if (!assignment || assignment.vaProfileId !== vaProfileId) throw new Error('Assignment does not belong to this VA')
  }

  const openCase = await prisma.termination.findFirst({
    where: { vaProfileId, isVoluntaryResignation: true, workflowStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
  })
  if (openCase) throw new Error('This VA already has an open resignation case.')

  const vaName = `${va.user.firstName} ${va.user.lastName}`.trim()
  const departmentId = va.user.memberships[0]?.departmentId ?? null
  const ticketNumber = await nextTerminationTicketNumber()

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        title: `Resignation — ${vaName}`,
        description: reason ?? `Resignation case for ${vaName}.`,
        category: 'TERMINATION',
        priority: 'HIGH',
        source: 'INTERNAL',
        createdBy: actorId,
        departmentId,
      },
    })
    const termination = await tx.termination.create({
      data: {
        vaProfileId,
        assignmentId: assignmentId ?? null,
        type: 'VAA_INITIATED' satisfies TerminationType,
        isVoluntaryResignation: true,
        resultingStatus: 'RESIGNED',
        reason,
        workflowStatus: 'INITIATED',
        ticketId: ticket.id,
        initiatedById: actorId,
        effectiveDate: effectiveDate ?? new Date(),
      },
    })

    // The TL's report IS the discussion record for this intake path — logDiscussionOutcome()
    // later upserts onto this same row rather than creating a duplicate.
    if (effectiveDate || recordingLink) {
      await tx.resignationDiscussion.create({
        data: {
          terminationId: termination.id,
          conductedAt: new Date(),
          retained: false,
          recordingLink: recordingLink ?? null,
          lastWorkingDay: effectiveDate ?? null,
        },
      })
    }

    return { terminationId: termination.id, ticketId: ticket.id }
  })
}
