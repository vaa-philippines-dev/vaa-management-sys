import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyMany } from '@/lib/notifications'
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

  const vas = await prisma.vAProfile.findMany({
    where: {
      status: 'ACTIVE',
      isActive: true,
      availabilityStatus: { not: 'ON_LEAVE' },
      user: { userType: 'VIRTUAL_ASSISTANT', isActive: true },
    },
    include: {
      user: {
        include: {
          memberships: {
            where: { endedAt: null },
            include: { department: { include: { head: true } } },
          },
        },
      },
      workLogs: { where: { workDate: { gte: dayStart, lte: dayEnd } } },
    },
  })

  const notifications: Parameters<typeof notifyMany>[0] = []

  for (const va of vas) {
    const dailyTarget = va.totalCapacityHours ? Number(va.totalCapacityHours) / WORKDAYS_PER_WEEK : null
    if (!dailyTarget) continue

    const loggedToday = va.workLogs.reduce((sum, w) => sum + Number(w.hours), 0)
    if (loggedToday >= dailyTarget) continue

    const primaryMembership = va.user.memberships.find((m) => m.isPrimary) ?? va.user.memberships[0]
    const head = primaryMembership?.department?.head
    if (!head) continue

    const vaName = `${va.user.firstName} ${va.user.lastName}`.trim()
    notifications.push({
      recipientId: head.id,
      type: 'HOURS_SHORTFALL',
      title: 'VA behind on daily hours',
      message: `${vaName} has logged ${loggedToday.toFixed(1)}h of a ${dailyTarget.toFixed(1)}h daily target today.`,
      entityType: 'VAProfile',
      entityId: va.id,
    })
  }

  await notifyMany(notifications)

  return NextResponse.json({ checked: vas.length, notified: notifications.length })
}
