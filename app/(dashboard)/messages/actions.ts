'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

async function requireChannelMembership(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { departmentId: true },
  })
  if (!channel) throw new Error('Channel not found')

  const membership = await prisma.departmentMembership.findFirst({
    where: { userId, departmentId: channel.departmentId, endedAt: null },
  })
  if (!membership) throw new Error('You are not a member of this department')

  return channel
}

export async function getMyChannels() {
  const user = await requireAuth()

  const memberships = await prisma.departmentMembership.findMany({
    where: { userId: user.id, endedAt: null },
    select: {
      department: {
        select: { id: true, name: true, channel: { select: { id: true } } },
      },
    },
  })

  return memberships
    .filter((m) => m.department.channel)
    .map((m) => ({
      channelId: m.department.channel!.id,
      departmentId: m.department.id,
      departmentName: m.department.name,
    }))
}

export async function getChannelMessages(channelId: string) {
  const user = await requireAuth()
  await requireChannelMembership(channelId, user.id)

  return prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { sender: { select: { id: true, firstName: true, lastName: true } } },
  })
}

export async function sendMessage(channelId: string, body: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty')

  const message = await prisma.message.create({
    data: { channelId, senderId: user.id, body: trimmed },
    include: { sender: { select: { id: true, firstName: true, lastName: true } } },
  })

  await logAudit({
    actorId: user.id,
    action: 'CREATE',
    entityType: 'Message',
    entityId: message.id,
    after: { channelId, body: trimmed },
    departmentId: channel.departmentId,
  })

  return message
}
