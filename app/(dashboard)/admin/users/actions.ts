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
}
