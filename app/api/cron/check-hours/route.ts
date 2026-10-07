import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyMany } from '@/lib/notifications'
import { notifyAvailabilityReviewsDue } from '@/lib/availability-review-notify'
import { ON_HOLD_AVAILABILITY } from '@/lib/va-availability-fields'
import { startOfDay, endOfDay } from 'date-fns'

const WORKDAYS_PER_WEEK = 5

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const dayStart = startOfDay(today)
  const dayEnd = endOfDay(today)

  // Narrow in SQL, not in JS: a VA with no capacity target can never produce a
  // notification (the `dailyTarget` guard below drops it), and neither can one
  // whose department has no head to notify. Selecting explicit fields rather
  // than `include`-ing whole rows matters too — this runs nightly over the
  // entire active roster, and the unfiltered version pulled every column of
  // each VAProfile, User, DepartmentMembership, Department and head User.
  const vas = await prisma.vAProfile.findMany({
    where: {
      status: 'ACTIVE',
      isActive: true,
      availabilityStatus: { notIn: ON_HOLD_AVAILABILITY },
      totalCapacityHours: { not: null, gt: 0 },
      user: {
        userType: 'VIRTUAL_ASSISTANT',
        isActive: true,
        memberships: { some: { endedAt: null, department: { headId: { not: null } } } },
      },
    },
    select: {
      id: true,
      totalCapacityHours: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          memberships: {
            where: { endedAt: null },
            select: {
              isPrimary: true,
              department: { select: { headId: true } },
            },
          },
        },
      },
      workLogs: {
        where: { workDate: { gte: dayStart, lte: dayEnd } },
        select: { hours: true },
      },
    },
  })

  const notifications: Parameters<typeof notifyMany>[0] = []

  for (const va of vas) {
    const dailyTarget = va.totalCapacityHours ? Number(va.totalCapacityHours) / WORKDAYS_PER_WEEK : null
    if (!dailyTarget) continue

    const loggedToday = va.workLogs.reduce((sum, w) => sum + Number(w.hours), 0)
    if (loggedToday >= dailyTarget) continue

    const primaryMembership = va.user.memberships.find((m) => m.isPrimary) ?? va.user.memberships[0]
    const headId = primaryMembership?.department?.headId
    if (!headId) continue

    const vaName = `${va.user.firstName} ${va.user.lastName}`.trim()
    notifications.push({
      recipientId: headId,
      type: 'HOURS_SHORTFALL',
      title: 'VA behind on daily hours',
      message: `${vaName} has logged ${loggedToday.toFixed(1)}h of a ${dailyTarget.toFixed(1)}h daily target today.`,
      entityType: 'VAProfile',
      entityId: va.id,
    })
  }

  await notifyMany(notifications)

  // Rides on this cron rather than its own: Vercel Hobby caps how many cron
  // jobs a project gets, and both are once-a-day sweeps of the roster.
  const availabilityReviews = await notifyAvailabilityReviewsDue(today)

  return NextResponse.json({ checked: vas.length, notified: notifications.length, availabilityReviews })
}
