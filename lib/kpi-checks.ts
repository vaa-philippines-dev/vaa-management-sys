import { addDays, addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import type { KpiMilestone } from '@/src/generated/prisma/enums'

export const KPI_MILESTONES: KpiMilestone[] = ['D4', 'W1', 'W2', 'M1', 'M2', 'M3', 'M6']

export const KPI_MILESTONE_LABELS: Record<KpiMilestone, string> = {
  D4: '4th Day',
  W1: 'Week 1',
  W2: 'Week 2',
  M1: 'Month 1',
  M2: 'Month 2',
  M3: 'Month 3',
  M6: 'Month 6',
}

// N business days after start, skipping Saturday/Sunday — matches the
// sheet's WORKDAY(start, 3) used for the D4 checkpoint.
function addWorkdays(start: Date, days: number): Date {
  let d = new Date(start)
  let added = 0
  while (added < days) {
    d = addDays(d, 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

// N calendar months after start (EDATE), pushed to the following Monday if
// it lands on a weekend — matches the sheet's M1/M2/M3(/M6) formulas exactly.
function addCalendarMonthsSkipWeekend(start: Date, months: number): Date {
  const d = addMonths(start, months)
  const dow = d.getDay()
  if (dow === 6) return addDays(d, 2) // Saturday -> Monday
  if (dow === 0) return addDays(d, 1) // Sunday -> Monday
  return d
}

// Ported directly from the DMF sheet's "Performance Monitoring" tab formulas
// (D4 = WORKDAY(start,3); W1/W2 = start+7/+14 calendar days; M1/M2/M3/M6 =
// EDATE(start, n) pushed off weekends) — not reinvented, so the due dates
// this app computes match what the sheet has always computed.
export function computeKpiCheckpoints(startDate: Date): { milestone: KpiMilestone; dueDate: Date }[] {
  return [
    { milestone: 'D4', dueDate: addWorkdays(startDate, 3) },
    { milestone: 'W1', dueDate: addDays(startDate, 7) },
    { milestone: 'W2', dueDate: addDays(startDate, 14) },
    { milestone: 'M1', dueDate: addCalendarMonthsSkipWeekend(startDate, 1) },
    { milestone: 'M2', dueDate: addCalendarMonthsSkipWeekend(startDate, 2) },
    { milestone: 'M3', dueDate: addCalendarMonthsSkipWeekend(startDate, 3) },
    { milestone: 'M6', dueDate: addCalendarMonthsSkipWeekend(startDate, 6) },
  ]
}

export type KpiCheckRow = {
  id: string
  vaProfileId: string
  vaName: string
  clientName: string
  dueDate: Date
  overdue: boolean
}

export type KpiChecksByMilestone = Record<KpiMilestone, KpiCheckRow[]>

function emptyByMilestone(): KpiChecksByMilestone {
  return { D4: [], W1: [], W2: [], M1: [], M2: [], M3: [], M6: [] }
}

// Not-yet-completed checkpoints for a department, grouped by milestone and
// sorted oldest-due-first (surfacing overdue ones first) — mirrors the
// sheet's per-milestone "KPI CHECK UPDATE" panels. A checkpoint is skipped
// (not shown) once the assignment's own endDate precedes it — the sheet's
// same guard against showing a check that's now moot because the engagement
// already ended before reaching that milestone.
export async function getDepartmentKpiChecks(departmentId: string): Promise<KpiChecksByMilestone> {
  const checks = await prisma.assignmentKpiCheck.findMany({
    where: { completed: false, assignment: { client: { departmentId } } },
    select: {
      id: true,
      milestone: true,
      dueDate: true,
      assignment: {
        select: {
          endDate: true,
          vaProfile: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
          client: { select: { name: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  const now = new Date()
  const result = emptyByMilestone()
  for (const c of checks) {
    if (c.assignment.endDate && c.assignment.endDate < c.dueDate) continue
    result[c.milestone].push({
      id: c.id,
      vaProfileId: c.assignment.vaProfile.id,
      vaName: `${c.assignment.vaProfile.user.firstName} ${c.assignment.vaProfile.user.lastName}`,
      clientName: c.assignment.client.name,
      dueDate: c.dueDate,
      overdue: c.dueDate < now,
    })
  }
  return result
}
