import { prisma } from '@/lib/prisma'
import { KPI_MILESTONES } from '@/lib/kpi-checks'
import {
  FEEDBACK_WINDOWS,
  type FeedbackCell,
  type FeedbackWindow,
  type PerformanceRow,
} from '@/lib/performance-fields'

// Prisma reads for the DMF sheet's "Performance Monitoring" tab — the KPI
// check-in grid and the two client-feedback blocks, per engagement.
// Server-only; the client board imports lib/performance-fields.ts.

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null

const fullName = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : null

// A window with no row yet is the same thing as an untouched one — the sheet
// has a blank cell, not a missing record — so it renders as an empty cell
// with a null id, and the first edit creates the row (see upsert in
// performance/actions.ts).
function emptyCell(window: FeedbackWindow): FeedbackCell {
  return {
    id: null,
    window,
    requested: false,
    emailSentAt: null,
    responseStatus: 'NOT_SENT',
    receivedAt: null,
    feedback: null,
    relayedToVa: false,
    relayedAt: null,
    awaitingRelay: false,
  }
}

// `departmentIds: null` means every department (admin/HR); an empty array
// means nothing in scope and returns no rows.
export async function getPerformanceRows(departmentIds: string[] | null): Promise<PerformanceRow[]> {
  const assignments = await prisma.assignment.findMany({
    where: {
      // Cancelled engagements never ran, so there's nothing to monitor; a
      // completed one still carries its history and stays visible.
      status: { in: ['ACTIVE', 'COMPLETED'] },
      ...(departmentIds === null ? {} : { client: { departmentId: { in: departmentIds } } }),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      client: { select: { name: true, department: { select: { name: true } } } },
      vaProfile: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              teamMemberships: {
                where: { endedAt: null },
                take: 1,
                select: { team: { select: { name: true } } },
              },
            },
          },
        },
      },
      // Person In-Charge, Shadow Trainer and Expertise Group are columns on
      // the sheet's Performance Monitoring tab too, but they're the same
      // values as its VA Preparation tab — so they're read from the
      // preparation record rather than stored twice.
      preparation: {
        select: {
          expertiseGroup: true,
          personInCharge: { select: { firstName: true, lastName: true } },
          shadowTrainer: { select: { firstName: true, lastName: true } },
        },
      },
      kpiChecks: { select: { id: true, milestone: true, dueDate: true, completed: true, completedAt: true } },
      clientFeedback: true,
    },
    orderBy: { startDate: 'desc' },
  })

  const now = new Date()

  return assignments.map((a) => {
    const byMilestone = new Map(a.kpiChecks.map((c) => [c.milestone, c]))
    const kpi = KPI_MILESTONES.flatMap((m) => {
      const c = byMilestone.get(m)
      if (!c) return []
      // A checkpoint the engagement ended before reaching is moot — the same
      // guard getDepartmentKpiChecks() applies on the dashboard.
      if (a.endDate && a.endDate < c.dueDate) return []
      return [
        {
          id: c.id,
          milestone: c.milestone,
          dueDate: c.dueDate.toISOString(),
          completed: c.completed,
          completedAt: iso(c.completedAt),
          overdue: !c.completed && c.dueDate < now,
          late: c.completed && c.completedAt !== null && c.completedAt > c.dueDate,
        },
      ]
    })

    const feedback = Object.fromEntries(
      FEEDBACK_WINDOWS.map((w) => {
        const row = a.clientFeedback.find((f) => f.window === w)
        if (!row) return [w, emptyCell(w)]
        return [
          w,
          {
            id: row.id,
            window: w,
            requested: row.requested,
            emailSentAt: iso(row.emailSentAt),
            responseStatus: row.responseStatus,
            receivedAt: iso(row.receivedAt),
            feedback: row.feedback,
            relayedToVa: row.relayedToVa,
            relayedAt: iso(row.relayedAt),
            awaitingRelay: row.requested && row.responseStatus === 'RESPONDED' && !row.relayedToVa,
          } satisfies FeedbackCell,
        ]
      })
    ) as Record<FeedbackWindow, FeedbackCell>

    return {
      assignmentId: a.id,
      vaProfileId: a.vaProfile.id,
      vaName: fullName(a.vaProfile.user) ?? 'Unknown VA',
      clientName: a.client.name,
      departmentName: a.client.department?.name ?? null,
      teamName: a.vaProfile.user.teamMemberships[0]?.team.name ?? null,
      startDate: a.startDate.toISOString(),
      endDate: iso(a.endDate),
      personInChargeName: fullName(a.preparation?.personInCharge),
      shadowTrainerName: fullName(a.preparation?.shadowTrainer),
      expertiseGroup: a.preparation?.expertiseGroup ?? null,

      kpi,
      kpiDone: kpi.filter((c) => c.completed).length,
      kpiOverdue: kpi.filter((c) => c.overdue).length,

      feedback,
    }
  })
}
