import { prisma } from '@/lib/prisma'

type NotifyEntry = {
  recipientId: string
  type: 'NEW_ASSIGNMENT' | 'HOURS_SHORTFALL'
  title: string
  message: string
  entityType?: string
  entityId?: string
}

export async function notify(entry: NotifyEntry): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        recipientId: entry.recipientId,
        type: entry.type,
        title: entry.title,
        message: entry.message,
        entityType: entry.entityType,
        entityId: entry.entityId,
      },
    })
  } catch (error) {
    console.error('[Notification] Failed to create notification:', error)
  }
}

export async function notifyMany(entries: NotifyEntry[]): Promise<void> {
  if (entries.length === 0) return
  try {
    await prisma.notification.createMany({
      data: entries.map((e) => ({
        recipientId: e.recipientId,
        type: e.type,
        title: e.title,
        message: e.message,
        entityType: e.entityType,
        entityId: e.entityId,
      })),
    })
  } catch (error) {
    console.error('[Notification] Failed to create notifications:', error)
  }
}
