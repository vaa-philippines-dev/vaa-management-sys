import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { ASSIGNMENT_TO_CLIENT_STATUS, startStatusAfter } from '@/lib/va-preparation-fields'
import type { AssignmentStatus, PreparationClientStatus } from '@/src/generated/prisma/enums'

// One path for every Assignment status change (FB-0014), whether it starts
// from the assignment page or from VA Preparation's VA STATUS WITH CLIENT:
//
// - the Assignment's status is what VA Availability, Performance Monitoring,
//   the hours-shortfall cron etc. read, so a pause/cancel recorded only on the
//   preparation row used to leave the VA counted as working the account;
// - the preparation row is what the DMF views read, so it's mirrored back
//   (with an effectivity date, which the dashboard's data-issues card
//   requires for anything not Active);
// - ending an engagement ends its additional-hours add-ons too.
//
// Callers do their own auth/scope checks first.

function todayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
}

export async function applyAssignmentStatus({
  actorId,
  assignmentId,
  status,
  syncPreparation = true,
  effectiveDate,
}: {
  actorId: string
  assignmentId: string
  status: AssignmentStatus
  // False when the caller just saved the preparation row itself.
  syncPreparation?: boolean
  // When the change took effect; defaults to today.
  effectiveDate?: Date | null
}) {
  const before = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      status: true,
      preparation: {
        select: { id: true, clientStatus: true, effectivityDate: true, startStatus: true, vaConnectStatus: true },
      },
    },
  })
  if (!before) throw new Error('Assignment not found')

  if (before.status !== status) {
    await prisma.assignment.update({ where: { id: assignmentId }, data: { status } })
    await logAudit({
      actorId,
      action: 'STATUS_CHANGE',
      entityType: 'Assignment',
      entityId: assignmentId,
      before: { status: before.status },
      after: { status },
    })
  }

  const prep = before.preparation
  if (syncPreparation && prep) {
    // VA STATUS WITH CLIENT stays blank until VA Connect is Done (see
    // resolveClientStatus) — an Active engagement that never got there keeps
    // it blank rather than claiming the VA is live with the client.
    let clientStatus: PreparationClientStatus | null = ASSIGNMENT_TO_CLIENT_STATUS[status]
    if (clientStatus === 'ACTIVE' && prep.vaConnectStatus !== 'DONE' && prep.clientStatus === null) clientStatus = null

    if (clientStatus !== prep.clientStatus) {
      const data = {
        clientStatus,
        effectivityDate: clientStatus === null ? prep.effectivityDate : (effectiveDate ?? todayUtc()),
        startStatus: startStatusAfter(prep.startStatus, clientStatus),
      }
      await prisma.assignmentPreparation.update({ where: { id: prep.id }, data })
      await logAudit({
        actorId,
        action: 'UPDATE',
        entityType: 'AssignmentPreparation',
        entityId: prep.id,
        before: { clientStatus: prep.clientStatus, startStatus: prep.startStatus },
        after: { clientStatus: data.clientStatus, startStatus: data.startStatus, syncedFrom: 'Assignment' },
      })
    }
  }

  // Otherwise a still-ACTIVE add-on would keep counting toward the VA's hours
  // on VA Availability after the VA stopped working the account.
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    const addOns = await prisma.assignment.findMany({
      where: { parentAssignmentId: assignmentId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true },
    })
    for (const a of addOns) {
      await applyAssignmentStatus({ actorId, assignmentId: a.id, status, effectiveDate })
    }
  }
}
