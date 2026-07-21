'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole, requireAdminMutator, canMutate, getManagedDepartmentIds, getCurrentUser, TEAM_MANAGE_ROLES, TEAM_LEADER_ASSIGN_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

async function assertDepartmentManaged(actor: Awaited<ReturnType<typeof getCurrentUser>>, departmentId: string) {
  if (!actor || canMutate(actor)) return
  const managedIds = getManagedDepartmentIds(actor)
  if (!managedIds.includes(departmentId)) {
    throw new Error('Forbidden: department not in your managed scope')
  }
}

async function getTeamDepartmentId(teamId: string): Promise<string> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { departmentId: true } })
  if (!team) throw new Error('Team not found')
  return team.departmentId
}

export async function createTeam(formData: FormData) {
  const actor = await requireRole(...TEAM_MANAGE_ROLES)

  const departmentId = formData.get('departmentId') as string
  const name = (formData.get('name') as string)?.trim()

  if (!departmentId || !name) {
    throw new Error('Department and team name are required')
  }

  await assertDepartmentManaged(actor, departmentId)

  const team = await prisma.team.create({
    data: { departmentId, name },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Team',
    entityId: team.id,
    after: { name, departmentId },
    departmentId,
  })

  revalidatePath('/teams')
  revalidateTag(CACHE_TAGS.teams, 'default')
  redirect(`/teams/${team.id}`)
}

export async function renameTeam(teamId: string, name: string) {
  const actor = await requireRole(...TEAM_MANAGE_ROLES)

  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Team name is required')
  }

  const departmentId = await getTeamDepartmentId(teamId)
  await assertDepartmentManaged(actor, departmentId)

  const before = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } })
  if (!before) throw new Error('Team not found')

  if (trimmed === before.name) return

  const duplicate = await prisma.team.findFirst({
    where: { departmentId, name: trimmed, NOT: { id: teamId } },
    select: { id: true },
  })
  if (duplicate) {
    throw new Error('A team with this name already exists in this department')
  }

  await prisma.team.update({ where: { id: teamId }, data: { name: trimmed } })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Team',
    entityId: teamId,
    before: { name: before.name },
    after: { name: trimmed },
    departmentId,
  })

  revalidatePath(`/teams/${teamId}`)
  revalidatePath('/teams')
  revalidateTag(CACHE_TAGS.teams, 'default')
}

export async function setTeamLeader(teamId: string, userId: string | null) {
  const actor = await requireRole(...TEAM_LEADER_ASSIGN_ROLES)

  const departmentId = await getTeamDepartmentId(teamId)
  await assertDepartmentManaged(actor, departmentId)

  if (userId) {
    const activeMembership = await prisma.teamMembership.findFirst({
      where: { teamId, userId, endedAt: null },
    })
    if (!activeMembership) {
      throw new Error('User must be an active team member before being made Team Leader')
    }
  }

  const before = await prisma.team.findUnique({ where: { id: teamId }, select: { leaderId: true } })

  await prisma.team.update({ where: { id: teamId }, data: { leaderId: userId } })

  await logAudit({
    actorId: actor.id,
    action: 'ROLE_CHANGE',
    entityType: 'Team',
    entityId: teamId,
    before: before ? { leaderId: before.leaderId } : undefined,
    after: { leaderId: userId },
    departmentId,
  })

  revalidatePath(`/teams/${teamId}`)
  revalidateTag(CACHE_TAGS.teams, 'default')
}

export async function setTempLeader(teamId: string, slot: 1 | 2, userId: string | null) {
  const actor = await requireRole(...TEAM_LEADER_ASSIGN_ROLES)

  const departmentId = await getTeamDepartmentId(teamId)
  await assertDepartmentManaged(actor, departmentId)

  if (userId) {
    const activeMembership = await prisma.teamMembership.findFirst({
      where: { teamId, userId, endedAt: null },
    })
    if (!activeMembership) {
      throw new Error('User must be an active team member before being made a Temp Leader')
    }
  }

  const field = slot === 1 ? 'tempLeader1Id' : 'tempLeader2Id'
  const before = await prisma.team.findUnique({ where: { id: teamId }, select: { [field]: true } })

  await prisma.team.update({ where: { id: teamId }, data: { [field]: userId } })

  await logAudit({
    actorId: actor.id,
    action: 'ROLE_CHANGE',
    entityType: 'Team',
    entityId: teamId,
    before: before ? { [field]: (before as Record<string, unknown>)[field] } : undefined,
    after: { [field]: userId },
    departmentId,
  })

  revalidatePath(`/teams/${teamId}`)
  revalidateTag(CACHE_TAGS.teams, 'default')
}

export async function addTeamMembers(teamId: string, userIds: string[]) {
  const actor = await requireRole(...TEAM_MANAGE_ROLES)

  const departmentId = await getTeamDepartmentId(teamId)
  await assertDepartmentManaged(actor, departmentId)

  const ids = userIds.filter(Boolean)
  if (ids.length === 0) return

  const alreadyActive = await prisma.teamMembership.findMany({
    where: { teamId, userId: { in: ids }, endedAt: null },
    select: { userId: true },
  })
  const alreadyActiveIds = new Set(alreadyActive.map((m) => m.userId))
  const toAdd = ids.filter((id) => !alreadyActiveIds.has(id))

  if (toAdd.length > 0) {
    await prisma.teamMembership.createMany({
      data: toAdd.map((userId) => ({ teamId, userId })),
    })
  }

  await logAudit({
    actorId: actor.id,
    action: 'MEMBER_ADD',
    entityType: 'Team',
    entityId: teamId,
    metadata: { userIds: toAdd },
    departmentId,
  })

  revalidatePath(`/teams/${teamId}`)
  revalidateTag(CACHE_TAGS.teams, 'default')
}

export async function removeTeamMembers(teamId: string, userIds: string[]) {
  const actor = await requireRole(...TEAM_MANAGE_ROLES)

  const departmentId = await getTeamDepartmentId(teamId)
  await assertDepartmentManaged(actor, departmentId)

  const ids = userIds.filter(Boolean)
  if (ids.length === 0) return

  await prisma.teamMembership.updateMany({
    where: { teamId, userId: { in: ids }, endedAt: null },
    data: { endedAt: new Date() },
  })

  await logAudit({
    actorId: actor.id,
    action: 'MEMBER_REMOVE',
    entityType: 'Team',
    entityId: teamId,
    metadata: { userIds: ids },
    departmentId,
  })

  revalidatePath(`/teams/${teamId}`)
  revalidateTag(CACHE_TAGS.teams, 'default')
}

export async function transferTeamMembers(fromTeamId: string, toTeamId: string, userIds: string[]) {
  const actor = await requireRole(...TEAM_MANAGE_ROLES)

  if (fromTeamId === toTeamId) {
    throw new Error('Cannot transfer members to the same team')
  }

  const fromDepartmentId = await getTeamDepartmentId(fromTeamId)
  const toDepartmentId = await getTeamDepartmentId(toTeamId)
  await assertDepartmentManaged(actor, fromDepartmentId)
  await assertDepartmentManaged(actor, toDepartmentId)

  const ids = userIds.filter(Boolean)
  if (ids.length === 0) return

  await prisma.$transaction(async (tx) => {
    await tx.teamMembership.updateMany({
      where: { teamId: fromTeamId, userId: { in: ids }, endedAt: null },
      data: { endedAt: new Date() },
    })
    await tx.teamMembership.createMany({
      data: ids.map((userId) => ({ teamId: toTeamId, userId })),
    })
  })

  await logAudit({
    actorId: actor.id,
    action: 'TRANSFER',
    entityType: 'TeamMembership',
    entityId: fromTeamId,
    metadata: { fromTeamId, toTeamId, userIds: ids },
    departmentId: toDepartmentId,
  })

  revalidatePath(`/teams/${fromTeamId}`)
  revalidatePath(`/teams/${toTeamId}`)
  revalidateTag(CACHE_TAGS.teams, 'default')
}

export async function deleteTeam(teamId: string) {
  const actor = await requireAdminMutator()

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, departmentId: true, _count: { select: { memberships: { where: { endedAt: null } } } } },
  })
  if (!team) throw new Error('Team not found')

  await prisma.team.delete({ where: { id: teamId } })

  await logAudit({
    actorId: actor.id,
    action: 'DELETE',
    entityType: 'Team',
    entityId: team.id,
    before: { name: team.name, departmentId: team.departmentId, memberCount: team._count.memberships },
    departmentId: team.departmentId,
  })

  revalidatePath('/teams')
  revalidatePath('/admin/teams')
  revalidateTag(CACHE_TAGS.teams, 'default')
}
