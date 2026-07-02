'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { validateCreate, validateUpdate, isLevelRecord, hasChildren, DepartmentValidationError } from '@/lib/departments'

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
