'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth, requireManager } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const MENTION_PATTERN = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g

const MESSAGE_SENDER_SELECT = {
  sender: { select: { id: true, firstName: true, lastName: true, messageColor: true, avatarUrl: true } },
  parent: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      sender: { select: { firstName: true, lastName: true } },
    },
  },
} as const

async function requireChannelMembership(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { departmentId: true, department: { select: { name: true } } },
  })
  if (!channel) throw new Error('Channel not found')

  const membership = await prisma.departmentMembership.findFirst({
    where: { userId, departmentId: channel.departmentId, endedAt: null },
  })
  if (!membership) throw new Error('You are not a member of this department')

  return channel
}

async function createMessageAndNotify(params: {
  channelId: string
  departmentId: string
  departmentName: string
  senderId: string
  senderFirstName: string
  senderAvatarUrl: string | null
  body: string
  parentId?: string
  forwardedFrom?: { id: string; body: string; senderName: string }
}) {
  const { channelId, departmentId, departmentName, senderId, senderFirstName, senderAvatarUrl, body, parentId, forwardedFrom } =
    params

  const mentionedUserIds = [...body.matchAll(MENTION_PATTERN)].map((m) => m[2])
  const uniqueMentionedIds = [...new Set(mentionedUserIds)].filter((id) => id !== senderId)

  const message = await prisma.message.create({
    data: {
      channelId,
      senderId,
      body,
      parentId,
      forwardedFromId: forwardedFrom?.id,
      forwardedFromBody: forwardedFrom?.body,
      forwardedFromSenderName: forwardedFrom?.senderName,
      mentions: uniqueMentionedIds.length
        ? { create: uniqueMentionedIds.map((mentionedUserId) => ({ mentionedUserId })) }
        : undefined,
    },
    include: MESSAGE_SENDER_SELECT,
  })

  if (uniqueMentionedIds.length) {
    await prisma.notification.createMany({
      data: uniqueMentionedIds.map((recipientId) => ({
        recipientId,
        type: 'NEW_MESSAGE' as const,
        title: `${senderFirstName} mentioned you in #${departmentName}`,
        message: body.replace(MENTION_PATTERN, '@$1').slice(0, 140),
        entityType: 'Channel',
        entityId: channelId,
        messageId: message.id,
        mentionerName: senderFirstName,
        mentionerAvatarUrl: senderAvatarUrl,
        departmentName,
      })),
    })
  }

  await logAudit({
    actorId: senderId,
    action: 'CREATE',
    entityType: 'Message',
    entityId: message.id,
    after: { channelId, body },
    departmentId,
  })

  return message
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
  const pinnedCounts = await Promise.all(
    channels.map((c) => prisma.message.count({ where: { channelId: c.channelId, pinned: true } }))
  )

  return channels.map((c, i) => ({
    ...c,
    unreadCount: unreadCounts[i],
    unreadMentions: unreadMentionCounts[i],
    pinnedCount: pinnedCounts[i],
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
    include: MESSAGE_SENDER_SELECT,
  })
}

export async function sendMessage(channelId: string, body: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty')

  return createMessageAndNotify({
    channelId,
    departmentId: channel.departmentId,
    departmentName: channel.department.name,
    senderId: user.id,
    senderFirstName: user.firstName,
    senderAvatarUrl: user.avatarUrl,
    body: trimmed,
  })
}

export async function replyToMessage(channelId: string, parentId: string, body: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty')

  const parent = await prisma.message.findUnique({
    where: { id: parentId },
    select: { id: true, channelId: true, senderId: true, deletedAt: true },
  })
  if (!parent || parent.channelId !== channelId) throw new Error('Original message not found in this channel')

  const message = await createMessageAndNotify({
    channelId,
    departmentId: channel.departmentId,
    departmentName: channel.department.name,
    senderId: user.id,
    senderFirstName: user.firstName,
    senderAvatarUrl: user.avatarUrl,
    body: trimmed,
    parentId,
  })

  if (parent.senderId !== user.id && !parent.deletedAt) {
    await prisma.notification.create({
      data: {
        recipientId: parent.senderId,
        type: 'MESSAGE_REPLY',
        title: `${user.firstName} replied to your message in #${channel.department.name}`,
        message: trimmed.replace(MENTION_PATTERN, '@$1').slice(0, 140),
        entityType: 'Channel',
        entityId: channelId,
        messageId: message.id,
        mentionerName: user.firstName,
        mentionerAvatarUrl: user.avatarUrl,
        departmentName: channel.department.name,
      },
    })
  }

  return message
}

export async function forwardMessage(sourceMessageId: string, targetChannelId: string) {
  const user = await requireAuth()

  const source = await prisma.message.findUnique({
    where: { id: sourceMessageId },
    select: {
      id: true,
      body: true,
      channelId: true,
      deletedAt: true,
      sender: { select: { firstName: true, lastName: true } },
    },
  })
  if (!source) throw new Error('Message not found')
  if (source.deletedAt) throw new Error('Cannot forward a deleted message')

  await requireChannelMembership(source.channelId, user.id)
  const targetChannel = await requireChannelMembership(targetChannelId, user.id)

  return createMessageAndNotify({
    channelId: targetChannelId,
    departmentId: targetChannel.departmentId,
    departmentName: targetChannel.department.name,
    senderId: user.id,
    senderFirstName: user.firstName,
    senderAvatarUrl: user.avatarUrl,
    body: source.body,
    forwardedFrom: {
      id: source.id,
      body: source.body,
      senderName: `${source.sender.firstName} ${source.sender.lastName}`,
    },
  })
}

export async function bumpMessage(messageId: string) {
  const user = await requireAuth()

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, deletedAt: true },
  })
  if (!message) throw new Error('Message not found')
  if (message.deletedAt) throw new Error('Cannot bump a deleted message')

  await requireChannelMembership(message.channelId, user.id)

  return replyToMessage(message.channelId, messageId, 'bumped this message')
}

export async function editMessage(messageId: string, body: string) {
  const user = await requireAuth()

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty')

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, senderId: true, deletedAt: true, body: true },
  })
  if (!message) throw new Error('Message not found')
  if (message.senderId !== user.id) throw new Error('You can only edit your own messages')
  if (message.deletedAt) throw new Error('Cannot edit a deleted message')

  const channel = await requireChannelMembership(message.channelId, user.id)

  const oldMentionedIds = new Set([...message.body.matchAll(MENTION_PATTERN)].map((m) => m[2]))
  const newMentionedIds = new Set(
    [...trimmed.matchAll(MENTION_PATTERN)].map((m) => m[2]).filter((id) => id !== user.id)
  )

  const addedIds = [...newMentionedIds].filter((id) => !oldMentionedIds.has(id))
  const removedIds = [...oldMentionedIds].filter((id) => !newMentionedIds.has(id))

  if (removedIds.length) {
    await prisma.messageMention.deleteMany({ where: { messageId, mentionedUserId: { in: removedIds } } })
  }
  if (addedIds.length) {
    await prisma.messageMention.createMany({
      data: addedIds.map((mentionedUserId) => ({ messageId, mentionedUserId })),
    })
    await prisma.notification.createMany({
      data: addedIds.map((recipientId) => ({
        recipientId,
        type: 'NEW_MESSAGE' as const,
        title: `${user.firstName} mentioned you in #${channel.department.name}`,
        message: trimmed.replace(MENTION_PATTERN, '@$1').slice(0, 140),
        entityType: 'Channel',
        entityId: message.channelId,
        messageId,
        mentionerName: user.firstName,
        mentionerAvatarUrl: user.avatarUrl,
        departmentName: channel.department.name,
      })),
    })
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body: trimmed, editedAt: new Date() },
    include: MESSAGE_SENDER_SELECT,
  })

  await logAudit({
    actorId: user.id,
    action: 'UPDATE',
    entityType: 'Message',
    entityId: messageId,
    before: { body: message.body },
    after: { body: trimmed },
    departmentId: channel.departmentId,
  })

  return updated
}

export async function deleteMessage(messageId: string) {
  const user = await requireAuth()

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, senderId: true, deletedAt: true },
  })
  if (!message) throw new Error('Message not found')
  if (message.deletedAt) throw new Error('Message already deleted')

  const isOwner = message.senderId === user.id
  const isModerator = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER'].includes(user.systemRole)
  if (!isOwner && !isModerator) throw new Error('Forbidden')

  const channel = await requireChannelMembership(message.channelId, user.id)

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
    include: MESSAGE_SENDER_SELECT,
  })

  await logAudit({
    actorId: user.id,
    action: 'DELETE',
    entityType: 'Message',
    entityId: messageId,
    departmentId: channel.departmentId,
  })

  return updated
}

export async function pinMessage(messageId: string, pinned: boolean) {
  const user = await requireManager()
  if (user.systemRole === 'EXECUTIVE') {
    throw new Error('View-only access. Executive role cannot modify data.')
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, deletedAt: true },
  })
  if (!message) throw new Error('Message not found')
  if (message.deletedAt) throw new Error('Cannot pin a deleted message')

  if (!['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole)) {
    await requireChannelMembership(message.channelId, user.id)
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: pinned
      ? { pinned: true, pinnedAt: new Date(), pinnedBy: user.id }
      : { pinned: false, pinnedAt: null, pinnedBy: null },
    include: MESSAGE_SENDER_SELECT,
  })

  await logAudit({
    actorId: user.id,
    action: 'STATUS_CHANGE',
    entityType: 'Message',
    entityId: messageId,
    after: { pinned },
  })

  return updated
}

export async function getPinnedMessages(channelId: string) {
  const user = await requireAuth()
  await requireChannelMembership(channelId, user.id)

  return prisma.message.findMany({
    where: { channelId, pinned: true },
    orderBy: { pinnedAt: 'desc' },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, messageColor: true, avatarUrl: true } },
      pinnedByUser: { select: { firstName: true, lastName: true } },
    },
  })
}

export async function replyFromNotification(notificationId: string, body: string) {
  const user = await requireAuth()

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, recipientId: true, messageId: true, read: true },
  })
  if (!notification) throw new Error('Notification not found')
  if (notification.recipientId !== user.id) throw new Error('Forbidden')
  if (!notification.messageId) throw new Error('This notification cannot be replied to')

  const message = await prisma.message.findUnique({
    where: { id: notification.messageId },
    select: { channelId: true },
  })
  if (!message) throw new Error('Original message not found')

  const reply = await replyToMessage(message.channelId, notification.messageId, body)

  if (!notification.read) {
    await prisma.notification.update({ where: { id: notificationId }, data: { read: true } })
  }

  return reply
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
