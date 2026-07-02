'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  validateCreate,
  validateUpdate,
  isLevelRecord,
  hasChildren,
  DepartmentValidationError,
  validateAcronym,
  validateName,
} from '@/lib/departments'

const ENTITY_USER = 'User'
const ENTITY_DEPARTMENT = 'Department'
const ENTITY_MEMBERSHIP = 'DepartmentMembership'
const ENTITY_ROLE = 'RoleAssignment'

async function getAdmin() {
  return requireSuperAdmin()
}

export async function updateUserRole(userId: string, systemRole: string) {
  const admin = await getAdmin()
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true, email: true, firstName: true, lastName: true } })

  await prisma.user.update({
    where: { id: userId },
    data: { systemRole: systemRole as any },
  })

  await logAudit({
    actorId: admin.id,
    action: 'ROLE_CHANGE',
    entityType: ENTITY_USER,
    entityId: userId,
    before: before ? { systemRole: before.systemRole } : undefined,
    after: { systemRole },
    metadata: { email: before?.email, name: `${before?.firstName} ${before?.lastName}` },
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
}

export async function updateUserType(userId: string, userType: string) {
  const admin = await getAdmin()
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { userType: true, email: true } })

  await prisma.user.update({
    where: { id: userId },
    data: { userType: userType as any },
  })

  await logAudit({
    actorId: admin.id,
    action: 'UPDATE',
    entityType: ENTITY_USER,
    entityId: userId,
    before: before ? { userType: before.userType } : undefined,
    after: { userType },
    metadata: { email: before?.email },
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const admin = await getAdmin()
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, email: true, firstName: true, lastName: true } })

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  })

  await logAudit({
    actorId: admin.id,
    action: 'STATUS_CHANGE',
    entityType: ENTITY_USER,
    entityId: userId,
    before: before ? { isActive: before.isActive } : undefined,
    after: { isActive },
    metadata: { email: before?.email, name: `${before?.firstName} ${before?.lastName}` },
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
}

export async function assignDepartmentMembership(
  userId: string,
  departmentId: string,
  positionId: string | null,
  isPrimary: boolean
) {
  const admin = await getAdmin()

  const existing = await prisma.departmentMembership.findUnique({
    where: { userId_departmentId: { userId, departmentId } },
  })

  let membershipId: string

  if (existing) {
    await prisma.departmentMembership.update({
      where: { id: existing.id },
      data: { positionId, isPrimary },
    })
    membershipId = existing.id
  } else {
    if (isPrimary) {
      await prisma.departmentMembership.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      })
    }
    const created = await prisma.departmentMembership.create({
      data: { userId, departmentId, positionId, isPrimary },
    })
    membershipId = created.id
  }

  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } })

  await logAudit({
    actorId: admin.id,
    action: existing ? 'UPDATE' : 'MEMBER_ADD',
    entityType: ENTITY_MEMBERSHIP,
    entityId: membershipId,
    before: existing ? { ...existing } : undefined,
    after: { userId, departmentId, positionId, isPrimary },
    metadata: { departmentName: dept?.name },
    departmentId,
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function removeDepartmentMembership(membershipId: string) {
  const admin = await getAdmin()
  const before = await prisma.departmentMembership.findUnique({
    where: { id: membershipId },
    include: { department: { select: { name: true } }, user: { select: { email: true } } },
  })

  await prisma.departmentMembership.delete({
    where: { id: membershipId },
  })

  if (before) {
    await logAudit({
      actorId: admin.id,
      action: 'MEMBER_REMOVE',
      entityType: ENTITY_MEMBERSHIP,
      entityId: membershipId,
      before: { userId: before.userId, departmentId: before.departmentId, positionId: before.positionId, isPrimary: before.isPrimary },
      after: undefined,
      metadata: { departmentName: before.department.name, userEmail: before.user.email },
      departmentId: before.departmentId,
    })
  }

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function assignTemporaryRole(
  userId: string,
  role: string,
  module: string,
  departmentId: string | null
) {
  const admin = await getAdmin()

  const created = await prisma.roleAssignment.create({
    data: {
      userId,
      role: role as any,
      module,
      departmentId,
      grantedBy: admin.id,
    },
  })

  await logAudit({
    actorId: admin.id,
    action: 'CREATE',
    entityType: ENTITY_ROLE,
    entityId: created.id,
    after: { userId, role, module, departmentId },
    departmentId,
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidateTag(CACHE_TAGS.admin, 'default')
}

export async function revokeTemporaryRole(assignmentId: string) {
  const admin = await getAdmin()
  const before = await prisma.roleAssignment.findUnique({
    where: { id: assignmentId },
    select: { userId: true, role: true, module: true, departmentId: true },
  })

  await prisma.roleAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false },
  })

  if (before) {
    await logAudit({
      actorId: admin.id,
      action: 'DELETE',
      entityType: ENTITY_ROLE,
      entityId: assignmentId,
      before: { userId: before.userId, role: before.role, module: before.module, departmentId: before.departmentId },
      metadata: { revokeMethod: 'deactivate' },
      departmentId: before.departmentId,
    })
  }

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidateTag(CACHE_TAGS.admin, 'default')
}

export async function createDepartment(name: string, description: string | null, isParent: boolean, parentId: string | null, level?: string | null) {
  const admin = await getAdmin()

  const clean = await validateCreate({ name, shortName: null, acronym: name.slice(0, 4).toUpperCase(), level: level ?? 'MANAGEMENT', parentId })

  const dept = await prisma.department.create({
    data: {
      name: clean.name,
      shortName: clean.shortName,
      acronym: clean.acronym,
      level: clean.level,
      description: description ?? null,
      isParent,
      parentId: clean.parentId,
    },
  })

  await logAudit({
    actorId: admin.id,
    action: 'CREATE',
    entityType: ENTITY_DEPARTMENT,
    entityId: dept.id,
    after: { name: clean.name, shortName: clean.shortName, acronym: clean.acronym, level: clean.level, description, isParent, parentId: clean.parentId },
    departmentId: dept.id,
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidatePath('/admin')
  revalidateTag(CACHE_TAGS.admin, 'default')
  revalidatePath('/departments')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function createDepartmentInline(formData: FormData) {
  const admin = await getAdmin()
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  if (!name) return

  const clean = await validateCreate({ name, acronym: name.slice(0, 4).toUpperCase(), level: 'MANAGEMENT' })

  const dept = await prisma.department.create({
    data: {
      name: clean.name,
      shortName: clean.shortName,
      acronym: clean.acronym,
      level: clean.level,
      description: description || null,
      isParent: true,
      parentId: null,
    },
  })

  await logAudit({
    actorId: admin.id,
    action: 'CREATE',
    entityType: ENTITY_DEPARTMENT,
    entityId: dept.id,
    after: { name: clean.name, shortName: clean.shortName, acronym: clean.acronym, level: clean.level, description },
    departmentId: dept.id,
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidatePath('/admin')
  revalidateTag(CACHE_TAGS.admin, 'default')
  revalidatePath('/departments')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function updateDepartment(id: string, data: { name?: string; shortName?: string | null; acronym?: string | null; level?: string | null; description?: string | null; isParent?: boolean; parentId?: string | null; status?: 'ACTIVE' | 'INACTIVE' }) {
  const admin = await getAdmin()
  const before = await prisma.department.findUnique({ where: { id }, select: { name: true, shortName: true, acronym: true, level: true, description: true, isParent: true, parentId: true, status: true } })
  if (!before) return

  const clean = await validateUpdate(id, {
    name: data.name,
    shortName: data.shortName,
    acronym: data.acronym,
    level: data.level,
    parentId: data.parentId,
  })

  await prisma.department.update({
    where: { id },
    data: {
      name: clean.name,
      shortName: clean.shortName,
      acronym: clean.acronym,
      level: clean.level,
      parentId: clean.parentId,
      description: data.description,
      isParent: data.isParent,
      status: data.status,
    },
  })

  await logAudit({
    actorId: admin.id,
    action: 'UPDATE',
    entityType: ENTITY_DEPARTMENT,
    entityId: id,
    before: { name: before.name, shortName: before.shortName, acronym: before.acronym, level: before.level, description: before.description, isParent: before.isParent, parentId: before.parentId, status: before.status },
    after: { name: clean.name, shortName: clean.shortName, acronym: clean.acronym, level: clean.level, description: data.description, isParent: data.isParent, parentId: clean.parentId, status: data.status },
    departmentId: id,
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidatePath('/admin')
  revalidateTag(CACHE_TAGS.admin, 'default')
  revalidatePath('/departments')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function deleteDepartment(id: string) {
  const admin = await getAdmin()
  const dept = await prisma.department.findUnique({ where: { id } })
  if (!dept) return
  if (await isLevelRecord(id)) {
    throw new DepartmentValidationError([{ field: 'id', message: 'Cannot delete a system Level record' }])
  }
  if (await hasChildren(id)) {
    throw new DepartmentValidationError([{ field: 'id', message: 'Cannot delete department with children. Reassign or deactivate first.' }])
  }
  await prisma.department.delete({ where: { id } })
  await logAudit({
    actorId: admin.id,
    action: 'DELETE',
    entityType: ENTITY_DEPARTMENT,
    entityId: id,
    before: { name: dept.name, level: dept.level },
    departmentId: id,
  })
  revalidatePath('/admin')
  revalidatePath('/departments')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function toggleDepartmentActive(id: string) {
  const admin = await getAdmin()
  const dept = await prisma.department.findUnique({ where: { id } })
  if (!dept) return

  const newStatus = dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  await prisma.department.update({
    where: { id },
    data: { status: newStatus },
  })

  await logAudit({
    actorId: admin.id,
    action: 'STATUS_CHANGE',
    entityType: ENTITY_DEPARTMENT,
    entityId: id,
    before: { status: dept.status },
    after: { status: newStatus },
    metadata: { name: dept.name },
    departmentId: id,
  })

  revalidatePath('/admin/users')
  revalidatePath('/admin')
  revalidatePath('/departments')
}

export async function editDepartment(id: string, formData: FormData) {
  const admin = await getAdmin()
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  if (!id || !name) return

  const before = await prisma.department.findUnique({ where: { id }, select: { name: true, description: true, level: true } })
  if (!before) return

  const clean = await validateUpdate(id, { name })

  await prisma.department.update({
    where: { id },
    data: { name: clean.name, description: description || null },
  })

  await logAudit({
    actorId: admin.id,
    action: 'UPDATE',
    entityType: ENTITY_DEPARTMENT,
    entityId: id,
    before: { name: before.name, description: before.description, level: before.level },
    after: { name: clean.name, description },
    departmentId: id,
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidatePath('/admin')
  revalidateTag(CACHE_TAGS.admin, 'default')
  revalidatePath('/departments')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function createUser(formData: FormData) {
  const admin = await getAdmin()

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const firstName = (formData.get('firstName') as string)?.trim()
  const lastName = (formData.get('lastName') as string)?.trim()
  const systemRole = (formData.get('systemRole') as string)?.trim()
  const userType = (formData.get('userType') as string)?.trim()

  if (!email) throw new Error('Email is required')
  if (!firstName || !lastName) throw new Error('First and last name are required')
  if (!systemRole || !userType) throw new Error('System role and user type are required')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error('A user with this email already exists')

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      systemRole: systemRole as any,
      userType: userType as any,
      isActive: true,
      ...(userType === 'VIRTUAL_ASSISTANT' && {
        vaProfile: { create: { hourlyRate: null } },
      }),
    },
  })

  await logAudit({
    actorId: admin.id,
    action: 'CREATE',
    entityType: ENTITY_USER,
    entityId: user.id,
    after: { email, firstName, lastName, systemRole, userType, isActive: true },
    metadata: { viaForm: 'admin/users' },
  })

  revalidatePath('/admin/users')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidatePath('/admin')
  revalidateTag(CACHE_TAGS.admin, 'default')
}

export async function updateUserRoleByForm(id: string, formData: FormData) {
  const role = formData.get('role') as string
  if (role) await updateUserRole(id, role)
}

export async function updateUserTypeByForm(id: string, formData: FormData) {
  const type = formData.get('type') as string
  if (type) await updateUserType(id, type)
}

export async function assignDeptByForm(id: string, formData: FormData) {
  const deptId = formData.get('departmentId') as string
  const posId = formData.get('positionId') as string
  const isPrimary = formData.get('isPrimary') === 'true'
  if (deptId) await assignDepartmentMembership(id, deptId, posId || null, isPrimary)
}

export async function assignTempRoleByForm(id: string, formData: FormData) {
  const role = formData.get('role') as string
  const module = formData.get('module') as string
  const deptId = formData.get('tempDeptId') as string
  if (role && module) await assignTemporaryRole(id, role, module, deptId || null)
}

// ── Department Merge / Split ─────────────────────────────────────

export type MergeReassignmentMap = {
  memberships: Record<string, string>
  clients: Record<string, string>
  assignments: Record<string, string>
  children: Record<string, string>
}

export type MergePreview = {
  source: { id: string; name: string; level: string | null }
  target: { id: string; name: string; level: string | null }
  sameLevel: boolean
  counts: {
    memberships: number
    clients: number
    assignments: number
    children: number
  }
}

export async function getMergePreview(sourceId: string, targetId: string): Promise<MergePreview> {
  const [source, target, memberships, clients, assignments, children] = await Promise.all([
    prisma.department.findUnique({ where: { id: sourceId }, select: { id: true, name: true, level: true, status: true } }),
    prisma.department.findUnique({ where: { id: targetId }, select: { id: true, name: true, level: true, status: true } }),
    prisma.departmentMembership.count({ where: { departmentId: sourceId, endedAt: null } }),
    prisma.client.count({ where: { departmentId: sourceId, isActive: true } }),
    prisma.assignment.count({ where: { client: { departmentId: sourceId }, status: 'ACTIVE' } }),
    prisma.department.count({ where: { parentId: sourceId, status: { in: ['ACTIVE', 'INACTIVE'] } } }),
  ])

  if (!source || !target) {
    throw new DepartmentValidationError([{ field: 'id', message: 'Department not found' }])
  }

  return {
    source: { id: source.id, name: source.name, level: source.level },
    target: { id: target.id, name: target.name, level: target.level },
    sameLevel: source.level === target.level,
    counts: { memberships, clients, assignments, children },
  }
}

export async function mergeDepartments(input: {
  sourceId: string
  targetId: string
  reassignments?: MergeReassignmentMap
}) {
  const admin = await getAdmin()

  if (input.sourceId === input.targetId) {
    throw new DepartmentValidationError([{ field: 'targetId', message: 'Source and target cannot be the same department' }])
  }

  const [source, target] = await Promise.all([
    prisma.department.findUnique({ where: { id: input.sourceId } }),
    prisma.department.findUnique({ where: { id: input.targetId } }),
  ])

  if (!source || !target) {
    throw new DepartmentValidationError([{ field: 'id', message: 'Department not found' }])
  }
  if (source.status === 'MERGED' || source.status === 'SPLIT') {
    throw new DepartmentValidationError([{ field: 'sourceId', message: `Cannot merge a department in status ${source.status}` }])
  }
  if (await isLevelRecord(input.sourceId)) {
    throw new DepartmentValidationError([{ field: 'sourceId', message: 'Cannot merge a system Level record' }])
  }
  if (await isLevelRecord(input.targetId)) {
    throw new DepartmentValidationError([{ field: 'targetId', message: 'Cannot merge into a system Level record' }])
  }
  if (source.level !== target.level) {
    throw new DepartmentValidationError([{ field: 'targetId', message: 'Source and target must be the same Level to merge' }])
  }

  await prisma.$transaction(async (tx) => {
    await tx.departmentMembership.updateMany({
      where: { departmentId: input.sourceId, endedAt: null },
      data: { departmentId: input.targetId },
    })
    await tx.client.updateMany({
      where: { departmentId: input.sourceId, isActive: true },
      data: { departmentId: input.targetId },
    })
    await tx.assignment.updateMany({
      where: { client: { departmentId: input.sourceId }, status: 'ACTIVE' },
      data: {},
    })
    await tx.department.updateMany({
      where: { parentId: input.sourceId, status: { in: ['ACTIVE', 'INACTIVE'] } },
      data: { parentId: input.targetId },
    })
    await tx.department.update({
      where: { id: input.sourceId },
      data: {
        status: 'MERGED',
        mergedIntoId: input.targetId,
        parentId: null,
        memberships: {
          updateMany: {
            where: { endedAt: null },
            data: { endedAt: new Date() },
          },
        },
      },
    })
  })

  await logAudit({
    actorId: admin.id,
    action: 'TRANSFER',
    entityType: 'Department',
    entityId: input.sourceId,
    before: { name: source.name, level: source.level, status: 'ACTIVE' },
    after: { name: source.name, status: 'MERGED', mergedIntoId: input.targetId },
    metadata: { operation: 'MERGE', targetId: input.targetId, targetName: target.name },
    departmentId: input.sourceId,
  })

  revalidatePath('/admin')
  revalidatePath('/departments')
  revalidatePath(`/departments`)
  revalidateTag(CACHE_TAGS.departments, 'default')
  revalidateTag(CACHE_TAGS.admin, 'default')
}

export type SplitPreview = {
  source: { id: string; name: string; level: string | null }
  counts: {
    memberships: number
    clients: number
    assignments: number
    children: number
  }
}

export async function getSplitPreview(sourceId: string): Promise<SplitPreview> {
  const [source, memberships, clients, assignments, children] = await Promise.all([
    prisma.department.findUnique({ where: { id: sourceId }, select: { id: true, name: true, level: true, status: true } }),
    prisma.departmentMembership.count({ where: { departmentId: sourceId, endedAt: null } }),
    prisma.client.count({ where: { departmentId: sourceId, isActive: true } }),
    prisma.assignment.count({ where: { client: { departmentId: sourceId }, status: 'ACTIVE' } }),
    prisma.department.count({ where: { parentId: sourceId, status: { in: ['ACTIVE', 'INACTIVE'] } } }),
  ])

  if (!source) {
    throw new DepartmentValidationError([{ field: 'id', message: 'Department not found' }])
  }

  return {
    source: { id: source.id, name: source.name, level: source.level },
    counts: { memberships, clients, assignments, children },
  }
}

export type SplitDetails = {
  source: { id: string; name: string; level: string | null }
  memberships: { id: string; userName: string; userEmail: string; position: string | null }[]
  clients: { id: string; name: string; contactName: string | null; isActive: boolean }[]
  children: { id: string; name: string; acronym: string | null }[]
}

export async function getSplitDetails(sourceId: string): Promise<SplitDetails> {
  const source = await prisma.department.findUnique({ where: { id: sourceId }, select: { id: true, name: true, level: true } })
  if (!source) throw new DepartmentValidationError([{ field: 'id', message: 'Department not found' }])

  const [memberships, clients, children] = await Promise.all([
    prisma.departmentMembership.findMany({
      where: { departmentId: sourceId, endedAt: null },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        position: { select: { title: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    }),
    prisma.client.findMany({
      where: { departmentId: sourceId },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { parentId: sourceId, status: { in: ['ACTIVE', 'INACTIVE'] } },
      orderBy: { name: 'asc' },
    }),
  ])

  return {
    source: { id: source.id, name: source.name, level: source.level },
    memberships: memberships.map((m) => ({
      id: m.id,
      userName: `${m.user.firstName} ${m.user.lastName}`.trim(),
      userEmail: m.user.email,
      position: m.position?.title ?? null,
    })),
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      contactName: c.contactName,
      isActive: c.isActive,
    })),
    children: children.map((d) => ({ id: d.id, name: d.name, acronym: d.acronym })),
  }
}

export type SplitNewDepartment = {
  name: string
  shortName?: string | null
  acronym?: string | null
  level?: string | null
  parentId?: string | null
  reassignMemberships?: string[]
  reassignClients?: string[]
  reassignChildren?: string[]
}

export async function splitDepartment(
  sourceId: string,
  newDepartments: SplitNewDepartment[]
) {
  const admin = await getAdmin()

  if (newDepartments.length < 2) {
    throw new DepartmentValidationError([{ field: 'newDepartments', message: 'Split must produce at least 2 new departments' }])
  }

  const source = await prisma.department.findUnique({ where: { id: sourceId } })
  if (!source) {
    throw new DepartmentValidationError([{ field: 'sourceId', message: 'Source department not found' }])
  }
  if (source.status === 'MERGED' || source.status === 'SPLIT') {
    throw new DepartmentValidationError([{ field: 'sourceId', message: `Cannot split a department in status ${source.status}` }])
  }
  if (await isLevelRecord(sourceId)) {
    throw new DepartmentValidationError([{ field: 'sourceId', message: 'Cannot split a system Level record' }])
  }

  const cleaned = await Promise.all(
    newDepartments.map(async (d) => {
      const errors: { field: string; message: string }[] = []
      const cleanName = validateName(d.name, errors)
      const cleanShort = d.shortName ? (() => { const s = d.shortName!.trim(); if (s.length > 50) errors.push({ field: 'shortName', message: 'Too long' }); return s })() : null
      const cleanAcronym = validateAcronym(d.acronym ?? d.name.slice(0, 4), errors)
      if (errors.length) throw new DepartmentValidationError(errors)
      return await validateCreate({
        name: cleanName,
        shortName: cleanShort,
        acronym: cleanAcronym,
        level: d.level ?? source.level ?? 'MANAGEMENT',
        parentId: d.parentId ?? source.parentId,
      })
    })
  )

  const created: { id: string; name: string; reassigned: { memberships: number; clients: number; children: number } }[] = []

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i]
      const reassign = newDepartments[i]

      const newDept = await tx.department.create({
        data: {
          name: c.name,
          shortName: c.shortName,
          acronym: c.acronym,
          level: c.level,
          parentId: c.parentId,
          isParent: source.isParent,
          splitFromId: sourceId,
        },
      })

      let mCount = 0
      let cCount = 0
      let chCount = 0

      if (reassign.reassignMemberships && reassign.reassignMemberships.length > 0) {
        const result = await tx.departmentMembership.updateMany({
          where: {
            id: { in: reassign.reassignMemberships },
            departmentId: sourceId,
          },
          data: { departmentId: newDept.id },
        })
        mCount = result.count
      }

      if (reassign.reassignClients && reassign.reassignClients.length > 0) {
        const result = await tx.client.updateMany({
          where: {
            id: { in: reassign.reassignClients },
            departmentId: sourceId,
          },
          data: { departmentId: newDept.id },
        })
        cCount = result.count
      }

      if (reassign.reassignChildren && reassign.reassignChildren.length > 0) {
        const result = await tx.department.updateMany({
          where: {
            id: { in: reassign.reassignChildren },
            parentId: sourceId,
          },
          data: { parentId: newDept.id },
        })
        chCount = result.count
      }

      created.push({ id: newDept.id, name: newDept.name, reassigned: { memberships: mCount, clients: cCount, children: chCount } })
    }

    await tx.department.update({
      where: { id: sourceId },
      data: {
        status: 'SPLIT',
        memberships: {
          updateMany: {
            where: { endedAt: null },
            data: { endedAt: new Date() },
          },
        },
      },
    })
  })

  for (const d of created) {
    await logAudit({
      actorId: admin.id,
      action: 'CREATE',
      entityType: 'Department',
      entityId: d.id,
      after: { name: d.name, splitFromId: sourceId, reassigned: d.reassigned },
      metadata: { operation: 'SPLIT', sourceId },
      departmentId: d.id,
    })
  }

  await logAudit({
    actorId: admin.id,
    action: 'TRANSFER',
    entityType: 'Department',
    entityId: sourceId,
    before: { name: source.name, level: source.level, status: 'ACTIVE' },
    after: { name: source.name, status: 'SPLIT' },
    metadata: { operation: 'SPLIT', newDepartments: created.map((d) => ({ id: d.id, name: d.name })) },
    departmentId: sourceId,
  })

  revalidatePath('/admin')
  revalidatePath('/departments')
  revalidateTag(CACHE_TAGS.departments, 'default')
  revalidateTag(CACHE_TAGS.admin, 'default')
}
