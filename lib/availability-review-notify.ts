import { prisma } from '@/lib/prisma'
import { notifyMany } from '@/lib/notifications'
import { getAvailabilityRows } from '@/lib/va-availability'
import { AVAILABILITY_REVIEW_DAYS } from '@/lib/va-availability-fields'

const DAY_MS = 86_400_000
// How far back a run looks when the last one was long ago (or never ran).
// Anything older is already sitting in the page's "Review overdue" filter.
const MAX_LOOKBACK_DAYS = 7
const NAMES_IN_MESSAGE = 5

// The DMF's 30-day cycle: once a VA's DMF UPDATE STATUS DATE passes, the
// department's managers are told to re-check it ("Change availability", or
// "Still accurate" to restart the window). One summary per department per
// run, not one per VA — a backlog of overdue rows must not bury the bell.
//
// "Due" uses exactly the page's REVIEW_OVERDUE rule (computeAlert), so every
// VA named in a notification shows the badge when the manager clicks through.
// Only records that came due since the previous run are announced; the total
// overdue count rides along so the rest of the backlog isn't invisible.
export async function notifyAvailabilityReviewsDue(now: Date = new Date()) {
  const last = await prisma.notification.findFirst({
    where: { type: 'AVAILABILITY_REVIEW_DUE' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  const floor = now.getTime() - MAX_LOOKBACK_DAYS * DAY_MS
  const since = last ? Math.max(last.createdAt.getTime(), floor) : now.getTime() - DAY_MS

  const rows = await getAvailabilityRows({ departmentIds: null })

  const byDept = new Map<string, { name: string; newlyDue: string[]; overdue: number }>()
  for (const r of rows) {
    // REVIEW_OVERDUE implies a DATE CHANGED, so the fallback below is safe.
    if (r.alert !== 'REVIEW_OVERDUE' || !r.availabilityChangedAt) continue
    const entry = byDept.get(r.departmentId) ?? { name: r.departmentName, newlyDue: [], overdue: 0 }
    entry.overdue++
    const due = r.availabilityReviewDueAt
      ? new Date(r.availabilityReviewDueAt).getTime()
      : new Date(r.availabilityChangedAt).getTime() + AVAILABILITY_REVIEW_DAYS * DAY_MS
    if (due > since) entry.newlyDue.push(r.name)
    byDept.set(r.departmentId, entry)
  }

  const departmentIds = [...byDept].filter(([, d]) => d.newlyDue.length > 0).map(([id]) => id)
  if (departmentIds.length === 0) return { departments: 0, notified: 0 }

  // Whoever owns the DMF columns for that department: its head plus its
  // Dept/Ops Managers (same permission tier, so both or neither).
  const departments = await prisma.department.findMany({
    where: { id: { in: departmentIds } },
    select: {
      id: true,
      headId: true,
      memberships: {
        where: {
          endedAt: null,
          user: { isActive: true, systemRole: { in: ['DEPT_MANAGER', 'OPERATIONS_MANAGER'] } },
        },
        select: { userId: true },
      },
    },
  })

  const notifications: Parameters<typeof notifyMany>[0] = []
  for (const dept of departments) {
    const d = byDept.get(dept.id)!
    const recipients = new Set([...(dept.headId ? [dept.headId] : []), ...dept.memberships.map((m) => m.userId)])
    if (recipients.size === 0) continue

    const shown = d.newlyDue.slice(0, NAMES_IN_MESSAGE).join(', ')
    const more = d.newlyDue.length > NAMES_IN_MESSAGE ? ` and ${d.newlyDue.length - NAMES_IN_MESSAGE} more` : ''
    const count = d.newlyDue.length === 1 ? '1 VA is' : `${d.newlyDue.length} VAs are`
    const total = d.overdue > d.newlyDue.length ? ` ${d.overdue} overdue in ${d.name} in total.` : ''
    for (const recipientId of recipients) {
      notifications.push({
        recipientId,
        type: 'AVAILABILITY_REVIEW_DUE',
        title: `Availability review due · ${d.name}`,
        message: `${count} due for a ${AVAILABILITY_REVIEW_DAYS}-day availability review: ${shown}${more}.${total}`,
        entityType: 'Department',
        entityId: dept.id,
      })
    }
  }

  await notifyMany(notifications)
  return { departments: departmentIds.length, notified: notifications.length }
}
