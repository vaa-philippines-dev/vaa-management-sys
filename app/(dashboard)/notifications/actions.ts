'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function getMyNotifications() {
  const user = await requireAuth()
  return prisma.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

export async function markNotificationRead(id: string) {
  const user = await requireAuth()
  await prisma.notification.updateMany({
    where: { id, recipientId: user.id },
    data: { read: true },
  })
}

export async function markNotificationUnread(id: string) {
  const user = await requireAuth()
  await prisma.notification.updateMany({
    where: { id, recipientId: user.id },
    data: { read: false },
  })
}

export async function markAllNotificationsRead() {
  const user = await requireAuth()
  await prisma.notification.updateMany({
    where: { recipientId: user.id, read: false },
    data: { read: true },
  })
}

export async function markAllNotificationsUnread() {
  const user = await requireAuth()
  await prisma.notification.updateMany({
    where: { recipientId: user.id, read: true },
    data: { read: false },
  })
}
