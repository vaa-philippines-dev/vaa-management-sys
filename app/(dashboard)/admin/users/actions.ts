'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth'

export async function updateUserRole(userId: string, systemRole: string) {
  await requireSuperAdmin()
  await prisma.user.update({
    where: { id: userId },
    data: { systemRole: systemRole as any },
  })
  revalidatePath('/admin/users')
}

export async function updateUserType(userId: string, userType: string) {
  await requireSuperAdmin()
  await prisma.user.update({
    where: { id: userId },
    data: { userType: userType as any },
  })
  revalidatePath('/admin/users')
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requireSuperAdmin()
  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  })
  revalidatePath('/admin/users')
}

export async function assignDepartmentMembership(
  userId: string,
  departmentId: string,
  positionId: string | null,
  isPrimary: boolean
) {
  await requireSuperAdmin()

  const existing = await prisma.departmentMembership.findUnique({
    where: { userId_departmentId: { userId, departmentId } },
  })

  if (existing) {
    await prisma.departmentMembership.update({
      where: { id: existing.id },
      data: { positionId, isPrimary },
    })
  } else {
    if (isPrimary) {
      await prisma.departmentMembership.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      })
    }
    await prisma.departmentMembership.create({
      data: { userId, departmentId, positionId, isPrimary },
    })
  }

  revalidatePath('/admin/users')
}

export async function removeDepartmentMembership(membershipId: string) {
  await requireSuperAdmin()
  await prisma.departmentMembership.delete({
    where: { id: membershipId },
  })
  revalidatePath('/admin/users')
}

export async function assignTemporaryRole(
  userId: string,
  role: string,
  module: string,
  departmentId: string | null
) {
  const admin = await requireSuperAdmin()

  await prisma.roleAssignment.create({
    data: {
      userId,
      role: role as any,
      module,
      departmentId,
      grantedBy: admin.id,
    },
  })

  revalidatePath('/admin/users')
}

export async function revokeTemporaryRole(assignmentId: string) {
  await requireSuperAdmin()
  await prisma.roleAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false },
  })
  revalidatePath('/admin/users')
}

export async function createDepartment(name: string, description: string | null, isParent: boolean, parentId: string | null) {
  await requireSuperAdmin()
  await prisma.department.create({
    data: { name, description: description ?? null, isParent, parentId },
  })
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  revalidatePath('/departments')
}

export async function createDepartmentInline(formData: FormData) {
  await requireSuperAdmin()
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  if (name) {
    await prisma.department.create({
      data: { name, description: description || null, isParent: true, parentId: null },
    })
  }
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  revalidatePath('/departments')
}

export async function updateDepartment(id: string, data: { name?: string; description?: string | null; isParent?: boolean; parentId?: string | null; isActive?: boolean }) {
  await requireSuperAdmin()
  await prisma.department.update({
    where: { id },
    data,
  })
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  revalidatePath('/departments')
}

export async function toggleDepartmentActive(id: string) {
  await requireSuperAdmin()
  const dept = await prisma.department.findUnique({ where: { id } })
  if (!dept) return
  await prisma.department.update({
    where: { id },
    data: { isActive: !dept.isActive },
  })
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  revalidatePath('/departments')
}

export async function editDepartment(id: string, formData: FormData) {
  await requireSuperAdmin()
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  if (!id || !name) return

  await prisma.department.update({
    where: { id },
    data: {
      name,
      description: description || null,
    },
  })

  revalidatePath('/admin/users')
  revalidatePath('/admin')
  revalidatePath('/departments')
}

export async function createUser(formData: FormData) {
  await requireSuperAdmin()

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

  await prisma.user.create({
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

  revalidatePath('/admin/users')
  revalidatePath('/admin')
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
