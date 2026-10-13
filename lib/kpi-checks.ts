import { addDays, addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import type { KpiMilestone } from '@/src/generated/prisma/enums'

// Re-exported from lib/kpi-checks-labels.ts, which holds no Prisma import so
// client components can use the labels. Kept exported from here too, since
// every existing server-side importer already reaches for them at this path.
export { KPI_MILESTONES, KPI_MILESTONE_LABELS } from '@/lib/kpi-checks-labels'
import { DEFAULT_KPI_MILESTONES, resolveKpiMilestones } from '@/lib/kpi-checks-labels'

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
// this app computes match what the sheet has always computed. D1 isn't one of
// the sheet's columns: it's the start date itself (day 1 of the D4 count).
// `milestones` is the department's schedule (getDepartmentKpiMilestones);
// it defaults to the sheet's seven.
export function computeKpiCheckpoints(
  startDate: Date,
  milestones: readonly KpiMilestone[] = DEFAULT_KPI_MILESTONES
): { milestone: KpiMilestone; dueDate: Date }[] {
  const all: { milestone: KpiMilestone; dueDate: Date }[] = [
    { milestone: 'D1', dueDate: new Date(startDate) },
    { milestone: 'D4', dueDate: addWorkdays(startDate, 3) },
    { milestone: 'W1', dueDate: addDays(startDate, 7) },
    { milestone: 'W2', dueDate: addDays(startDate, 14) },
    { milestone: 'M1', dueDate: addCalendarMonthsSkipWeekend(startDate, 1) },
    { milestone: 'M2', dueDate: addCalendarMonthsSkipWeekend(startDate, 2) },
    { milestone: 'M3', dueDate: addCalendarMonthsSkipWeekend(startDate, 3) },
    { milestone: 'M6', dueDate: addCalendarMonthsSkipWeekend(startDate, 6) },
  ]
  return all.filter((c) => milestones.includes(c.milestone))
}

// The milestones a department runs — what a new engagement for one of its
// clients gets seeded with. A client with no department gets the default.
export async function getDepartmentKpiMilestones(departmentId: string | null | undefined): Promise<KpiMilestone[]> {
  if (!departmentId) return DEFAULT_KPI_MILESTONES
  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { kpiMilestones: true } })
  return resolveKpiMilestones(dept?.kpiMilestones)
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
  return { D1: [], D4: [], W1: [], W2: [], M1: [], M2: [], M3: [], M6: [] }
}

// Not-yet-completed checkpoints for a department, grouped by milestone and
// sorted oldest-due-first (surfacing overdue ones first) — mirrors the
// sheet's per-milestone "KPI CHECK UPDATE" panels. A checkpoint is skipped
// (not shown) once the assignment's own endDate precedes it — the sheet's
// same guard against showing a check that's now moot because the engagement
// already ended before reaching that milestone.
export async function getDepartmentKpiChecks(departmentId: string): Promise<KpiChecksByMilestone> {
  const checks = await prisma.assignmentKpiCheck.findMany({
    // Only running engagements, same as the TMF's check-ins due: a paused,
    // cancelled or ended one has nobody to hold the call with.
    where: { completed: false, assignment: { status: 'ACTIVE', client: { departmentId } } },
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
