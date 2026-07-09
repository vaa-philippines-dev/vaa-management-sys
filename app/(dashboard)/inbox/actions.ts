'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const MENTION_PATTERN = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g

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

  const channels = memberships
    .filter((m) => m.department.channel)
    .map((m) => ({
      channelId: m.department.channel!.id,
      departmentId: m.department.id,
      departmentName: m.department.name,
    }))

  const reads = await prisma.channelRead.findMany({
    where: { userId: user.id, channelId: { in: channels.map((c) => c.channelId) } },
  })
  const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]))

  const unreadCounts = await Promise.all(
    channels.map((c) =>
      prisma.message.count({
        where: { channelId: c.channelId, createdAt: { gt: readMap.get(c.channelId) ?? new Date(0) } },
      })
    )
  )
  const unreadMentionCounts = await Promise.all(
    channels.map((c) =>
      prisma.messageMention.count({
        where: {
          mentionedUserId: user.id,
          message: {
            channelId: c.channelId,
            createdAt: { gt: readMap.get(c.channelId) ?? new Date(0) },
          },
        },
      })
    )
  )

  return channels.map((c, i) => ({
    ...c,
    unreadCount: unreadCounts[i],
    unreadMentions: unreadMentionCounts[i],
  }))
}

export async function getChannelMembers(channelId: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)

  const memberships = await prisma.departmentMembership.findMany({
    where: { departmentId: channel.departmentId, endedAt: null },
    select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  })

  return memberships.map((m) => m.user)
}

export async function getChannelMessages(channelId: string) {
  const user = await requireAuth()
  await requireChannelMembership(channelId, user.id)

  return prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, messageColor: true } },
    },
  })
}

export async function sendMessage(channelId: string, body: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty')

  const mentionedUserIds = [...trimmed.matchAll(MENTION_PATTERN)].map((m) => m[2])
  const uniqueMentionedIds = [...new Set(mentionedUserIds)].filter((id) => id !== user.id)

  const message = await prisma.message.create({
    data: {
      channelId,
      senderId: user.id,
      body: trimmed,
      mentions: uniqueMentionedIds.length
        ? { create: uniqueMentionedIds.map((mentionedUserId) => ({ mentionedUserId })) }
        : undefined,
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, messageColor: true } },
    },
  })

  if (uniqueMentionedIds.length) {
    await prisma.notification.createMany({
      data: uniqueMentionedIds.map((recipientId) => ({
        recipientId,
        type: 'NEW_MESSAGE' as const,
        title: `${user.firstName} mentioned you`,
        message: trimmed.replace(MENTION_PATTERN, '@$1').slice(0, 140),
        entityType: 'Channel',
        entityId: channelId,
      })),
    })
  }

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

export async function markChannelRead(channelId: string) {
  const user = await requireAuth()
  await requireChannelMembership(channelId, user.id)

  await prisma.channelRead.upsert({
    where: { userId_channelId: { userId: user.id, channelId } },
    create: { userId: user.id, channelId },
    update: { lastReadAt: new Date() },
  })
}

export async function setMessageColor(color: 'RED' | 'BLUE' | 'YELLOW') {
  const user = await requireAuth()
  await prisma.user.update({ where: { id: user.id }, data: { messageColor: color } })
}

export async function getUserProfile(userId: string) {
  await requireAuth()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      systemRole: true,
      memberships: {
        where: { endedAt: null },
        select: { isPrimary: true, department: { select: { name: true } }, position: { select: { title: true } } },
      },
    },
  })
  if (!user) return null

  const primary = user.memberships.find((m) => m.isPrimary) ?? user.memberships[0]

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    systemRole: user.systemRole,
    departmentName: primary?.department?.name ?? null,
    positionTitle: primary?.position?.title ?? null,
  }
}
