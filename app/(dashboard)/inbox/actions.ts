'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth, requireManager } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const MENTION_PATTERN = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g
const ANNOUNCEMENT_POSTER_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER']

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
    select: { kind: true, departmentId: true, department: { select: { name: true } } },
  })
  if (!channel) throw new Error('Channel not found')

  if (channel.kind === 'ANNOUNCEMENTS') return channel

  if (channel.kind === 'DIRECT') {
    const participant = await prisma.channelParticipant.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!participant) throw new Error('You are not a participant in this conversation')
    return { ...channel, clearedAt: participant.clearedAt }
  }

  if (!channel.departmentId) throw new Error('Channel is misconfigured (no department)')
  const membership = await prisma.departmentMembership.findFirst({
    where: { userId, departmentId: channel.departmentId, endedAt: null },
  })
  if (!membership) throw new Error('You are not a member of this department')

  return channel
}

function assertCanPostInChannel(channelKind: string, systemRole: string) {
  if (channelKind === 'ANNOUNCEMENTS' && !ANNOUNCEMENT_POSTER_ROLES.includes(systemRole)) {
    throw new Error('Only admins and managers can post in #announcements')
  }
}

async function createMessageAndNotify(params: {
  channelId: string
  departmentId?: string | null
  departmentName?: string | null
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
        title: departmentName ? `${senderFirstName} mentioned you in #${departmentName}` : `${senderFirstName} mentioned you`,
        message: body.replace(MENTION_PATTERN, '@$1').slice(0, 140),
        entityType: 'Channel',
        entityId: channelId,
        messageId: message.id,
        mentionerName: senderFirstName,
        mentionerAvatarUrl: senderAvatarUrl,
        departmentName: departmentName ?? null,
      })),
    })
  }

  await logAudit({
    actorId: senderId,
    action: 'CREATE',
    entityType: 'Message',
    entityId: message.id,
    after: { channelId, body },
    departmentId: departmentId ?? undefined,
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

  const announcementsChannel = await prisma.channel.findFirst({
    where: { kind: 'ANNOUNCEMENTS' },
    select: { id: true },
  })

  const deptChannels = memberships
    .filter((m) => m.department.channel)
    .map((m) => ({
      kind: 'DEPARTMENT' as const,
      channelId: m.department.channel!.id,
      departmentId: m.department.id,
      departmentName: m.department.name,
    }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName))

  const channels = announcementsChannel
    ? [
        {
          kind: 'ANNOUNCEMENTS' as const,
          channelId: announcementsChannel.id,
          departmentId: null,
          departmentName: 'announcements',
        },
        ...deptChannels,
      ]
    : deptChannels

  const dmParticipations = await prisma.channelParticipant.findMany({
    where: { userId: user.id, channel: { kind: 'DIRECT' } },
    select: {
      muted: true,
      archived: true,
      clearedAt: true,
      channel: {
        select: {
          id: true,
          participants: {
            where: { userId: { not: user.id } },
            select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          },
        },
      },
    },
  })
  const directMessages = dmParticipations.map((p) => ({
    kind: 'DIRECT' as const,
    channelId: p.channel.id,
    muted: p.muted,
    archived: p.archived,
    clearedAt: p.clearedAt,
    otherUser: p.channel.participants[0]?.user ?? null,
  }))
  const clearedAtByChannel = new Map(directMessages.map((d) => [d.channelId, d.clearedAt]))

  const allChannelIds = [...channels.map((c) => c.channelId), ...directMessages.map((c) => c.channelId)]

  const reads = await prisma.channelRead.findMany({
    where: { userId: user.id, channelId: { in: allChannelIds } },
  })
  const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]))
  const sinceFor = (id: string) => {
    const readAt = readMap.get(id) ?? new Date(0)
    const clearedAt = clearedAtByChannel.get(id)
    return clearedAt && clearedAt > readAt ? clearedAt : readAt
  }

  const [unreadCounts, unreadMentionCounts, pinnedCounts, lastMessages] = await Promise.all([
    Promise.all(allChannelIds.map((id) => prisma.message.count({ where: { channelId: id, createdAt: { gt: sinceFor(id) } } }))),
    Promise.all(
      allChannelIds.map((id) =>
        prisma.messageMention.count({
          where: { mentionedUserId: user.id, message: { channelId: id, createdAt: { gt: sinceFor(id) } } },
        })
      )
    ),
    Promise.all(allChannelIds.map((id) => prisma.message.count({ where: { channelId: id, pinned: true } }))),
    Promise.all(
      allChannelIds.map((id) =>
        prisma.message.findFirst({
          where: { channelId: id, createdAt: { gt: clearedAtByChannel.get(id) ?? new Date(0) } },
          orderBy: { createdAt: 'desc' },
          select: { body: true, createdAt: true, senderId: true },
        })
      )
    ),
  ])

  const countsById = new Map(
    allChannelIds.map((id, i) => [
      id,
      { unreadCount: unreadCounts[i], unreadMentions: unreadMentionCounts[i], pinnedCount: pinnedCounts[i], lastMessage: lastMessages[i] },
    ])
  )

  return {
    channels: channels.map((c) => ({ ...c, ...countsById.get(c.channelId)! })),
    directMessages: directMessages
      .map(({ clearedAt: _clearedAt, ...c }) => ({ ...c, ...countsById.get(c.channelId)! }))
      .sort((a, b) => Number(a.archived) - Number(b.archived)),
  }
}

export async function getChannelMembers(channelId: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)

  if (channel.kind === 'ANNOUNCEMENTS') return []

  if (channel.kind === 'DIRECT') {
    const participants = await prisma.channelParticipant.findMany({
      where: { channelId },
      select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    })
    return participants.map((p) => p.user)
  }

  const memberships = await prisma.departmentMembership.findMany({
    where: { departmentId: channel.departmentId!, endedAt: null },
    select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  })

  return memberships.map((m) => m.user)
}

const MESSAGE_PAGE_SIZE = 50

export async function getChannelMessages(channelId: string, cursor?: { createdAt: string | Date; id: string }) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)
  const clearedAt = 'clearedAt' in channel ? channel.clearedAt : null

  const messages = await prisma.message.findMany({
    where: {
      channelId,
      ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: MESSAGE_PAGE_SIZE + 1,
    include: MESSAGE_SENDER_SELECT,
  })

  const hasMore = messages.length > MESSAGE_PAGE_SIZE
  const page = messages.slice(0, MESSAGE_PAGE_SIZE).reverse()

  return { messages: page, hasMore }
}

export async function sendMessage(channelId: string, body: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)
  assertCanPostInChannel(channel.kind, user.systemRole)

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty')

  return createMessageAndNotify({
    channelId,
    departmentId: channel.kind === 'DEPARTMENT' ? channel.departmentId : null,
    departmentName: channel.kind === 'DEPARTMENT' ? channel.department?.name : null,
    senderId: user.id,
    senderFirstName: user.firstName,
    senderAvatarUrl: user.avatarUrl,
    body: trimmed,
  })
}

export async function replyToMessage(channelId: string, parentId: string, body: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)
  assertCanPostInChannel(channel.kind, user.systemRole)

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty')

  const parent = await prisma.message.findUnique({
    where: { id: parentId },
    select: { id: true, channelId: true, senderId: true, deletedAt: true },
  })
  if (!parent || parent.channelId !== channelId) throw new Error('Original message not found in this channel')

  const departmentName = channel.kind === 'DEPARTMENT' ? channel.department?.name : null

  const message = await createMessageAndNotify({
    channelId,
    departmentId: channel.kind === 'DEPARTMENT' ? channel.departmentId : null,
    departmentName,
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
        title: departmentName ? `${user.firstName} replied to your message in #${departmentName}` : `${user.firstName} replied to your message`,
        message: trimmed.replace(MENTION_PATTERN, '@$1').slice(0, 140),
        entityType: 'Channel',
        entityId: channelId,
        messageId: message.id,
        mentionerName: user.firstName,
        mentionerAvatarUrl: user.avatarUrl,
        departmentName,
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
  assertCanPostInChannel(targetChannel.kind, user.systemRole)

  return createMessageAndNotify({
    channelId: targetChannelId,
    departmentId: targetChannel.kind === 'DEPARTMENT' ? targetChannel.departmentId : null,
    departmentName: targetChannel.kind === 'DEPARTMENT' ? targetChannel.department?.name : null,
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
  const departmentName = channel.kind === 'DEPARTMENT' ? channel.department?.name : null

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
        title: departmentName ? `${user.firstName} mentioned you in #${departmentName}` : `${user.firstName} mentioned you`,
        message: trimmed.replace(MENTION_PATTERN, '@$1').slice(0, 140),
        entityType: 'Channel',
        entityId: message.channelId,
        messageId,
        mentionerName: user.firstName,
        mentionerAvatarUrl: user.avatarUrl,
        departmentName,
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
    departmentId: channel.kind === 'DEPARTMENT' ? (channel.departmentId ?? undefined) : undefined,
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
  const isModerator = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER'].includes(user.systemRole)
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
    departmentId: channel.kind === 'DEPARTMENT' ? (channel.departmentId ?? undefined) : undefined,
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

export async function pinDirectMessage(messageId: string, pinned: boolean) {
  const user = await requireAuth()

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, deletedAt: true },
  })
  if (!message) throw new Error('Message not found')
  if (message.deletedAt) throw new Error('Cannot pin a deleted message')

  const channel = await requireChannelMembership(message.channelId, user.id)
  if (channel.kind !== 'DIRECT') throw new Error('Use pinMessage for department channels')

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: pinned
      ? { pinned: true, pinnedAt: new Date(), pinnedBy: user.id }
      : { pinned: false, pinnedAt: null, pinnedBy: null },
    include: MESSAGE_SENDER_SELECT,
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

export async function setMessageColor(color: 'BLUE' | 'RED' | 'GREEN' | 'YELLOW' | 'BLACK') {
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

export async function findOrCreateDirectMessageChannel(otherUserId: string) {
  const user = await requireAuth()
  if (otherUserId === user.id) throw new Error('Cannot start a DM with yourself')

  const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } })
  if (!other) throw new Error('User not found')

  const dmKey = [user.id, otherUserId].sort().join(':')

  const existing = await prisma.channel.findUnique({ where: { dmKey } })
  if (existing) return { channelId: existing.id }

  try {
    const channel = await prisma.channel.create({
      data: {
        kind: 'DIRECT',
        dmKey,
        participants: { createMany: { data: [{ userId: user.id }, { userId: otherUserId }] } },
      },
    })
    return { channelId: channel.id }
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      const raced = await prisma.channel.findUnique({ where: { dmKey } })
      if (raced) return { channelId: raced.id }
    }
    throw e
  }
}

export async function muteChannel(channelId: string, muted: boolean) {
  const user = await requireAuth()
  await prisma.channelParticipant.update({
    where: { channelId_userId: { channelId, userId: user.id } },
    data: { muted },
  })
}

export async function archiveDirectMessage(channelId: string, archived: boolean) {
  const user = await requireAuth()
  await prisma.channelParticipant.update({
    where: { channelId_userId: { channelId, userId: user.id } },
    data: { archived },
  })
}

export async function clearDirectMessage(channelId: string) {
  const user = await requireAuth()
  await prisma.channelParticipant.update({
    where: { channelId_userId: { channelId, userId: user.id } },
    data: { clearedAt: new Date() },
  })
}

export async function getOrgUsersForDMPicker(query: string) {
  const user = await requireAuth()
  const trimmed = query.trim()

  return prisma.user.findMany({
    where: {
      id: { not: user.id },
      isActive: true,
      ...(trimmed
        ? {
            OR: [
              { firstName: { contains: trimmed, mode: 'insensitive' } },
              { lastName: { contains: trimmed, mode: 'insensitive' } },
              { email: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
    take: 25,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })
}

export async function searchChannelMessages(channelId: string, query: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)
  const clearedAt = 'clearedAt' in channel ? channel.clearedAt : null

  const trimmed = query.trim()
  if (!trimmed) return []

  return prisma.message.findMany({
    where: {
      channelId,
      deletedAt: null,
      body: { contains: trimmed, mode: 'insensitive' },
      ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: MESSAGE_SENDER_SELECT,
  })
}

export async function getGroupInfo(channelId: string) {
  const user = await requireAuth()
  const channel = await requireChannelMembership(channelId, user.id)
  if (channel.kind !== 'DEPARTMENT') throw new Error('Group info is only available for department channels')

  const [department, memberships, pinnedCount] = await Promise.all([
    prisma.department.findUnique({ where: { id: channel.departmentId! }, select: { name: true, description: true } }),
    prisma.departmentMembership.findMany({
      where: { departmentId: channel.departmentId!, endedAt: null },
      select: {
        isPrimary: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, systemRole: true } },
        position: { select: { title: true } },
      },
    }),
    prisma.message.count({ where: { channelId, pinned: true } }),
  ])

  return { departmentName: department?.name ?? null, description: department?.description ?? null, members: memberships, pinnedCount }
}
