import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createServerSupabase()
  if (!supabase) {
    return prisma.user.findFirst({
      where: { systemRole: 'DEPT_MANAGER' },
      include: {
        vaProfile: true,
        profile: true,
        memberships: { include: { department: true, position: true } },
        roleAssignments: { where: { status: 'ACTIVE' } },
      },
    })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  return prisma.user.findUnique({
    where: { email: user.email! },
    include: {
      vaProfile: true,
      profile: true,
      memberships: { include: { department: true, position: true } },
      roleAssignments: { where: { status: 'ACTIVE' } },
    },
  })
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireRole(...roles: string[]) {
  const user = await requireAuth()
  if (!roles.includes(user.systemRole)) throw new Error('Forbidden')
  return user
}

export async function requireSuperAdmin() {
  return requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN')
}

export async function requireAdminMutator() {
  const user = await requireAuth()
  if (!['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole)) {
    throw new Error('View-only access. Executive role cannot modify data.')
  }
  return user
}

export function canMutate(user: { systemRole: string } | null | undefined): boolean {
  if (!user) return false
  return ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole)
}

export async function requireManager() {
  return requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')
}

export async function requireVA() {
  const user = await requireAuth()
  if (user.userType !== 'VIRTUAL_ASSISTANT') throw new Error('Forbidden')
  return user
}

export function getPrimaryDepartment(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return null
  const primary = user.memberships?.find((m) => m.isPrimary)
  return primary?.department ?? user.memberships?.[0]?.department ?? null
}

export function hasModuleAccess(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  module: string,
  action: 'read' | 'write' | 'approve' = 'read'
): boolean {
  if (!user) return false
  if (['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole)) return true
  if (user.systemRole === 'EXECUTIVE' && action === 'read') return true

  const tempRoles = user.roleAssignments?.filter((ra) => ra.module === module) ?? []
  if (action === 'read' && tempRoles.some((r) => r.role === 'VIEWER')) return true
  if (action === 'write' && tempRoles.some((r) => r.role === 'CONTRIBUTOR')) return true
  if (action === 'approve' && tempRoles.some((r) => r.role === 'APPROVER')) return true

  return false
}
