import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

export const CLIENT_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF']
export const ASSIGNMENT_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF']
export const VA_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER']
// Ticketing: only admins can view every ticket and manage them (assign/close/resolve).
// EXECUTIVE can view every ticket but not mutate it (view-only, same as requireAdminMutator()).
// Everyone else (DEPT_MANAGER, STAFF, VA) only sees tickets they created or are assigned to.
export const TICKET_VIEW_ALL_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']
export const TICKET_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN']
// Team creation + membership composition (add/remove/transfer) — Dept Manager owns team composition.
export const TEAM_MANAGE_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER']
// Team Leader + both Temp Leader slots — Operations Manager owns who leads, not who's on the roster.
export const TEAM_LEADER_ASSIGN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'OPERATIONS_MANAGER']

// Dev-only auth bypass for local testing of multi-user flows (e.g. Inbox
// realtime) without needing two real Google OAuth logins. Only ever active
// when NODE_ENV !== 'production' AND DEV_AUTH_BYPASS_EMAIL is set locally —
// this env var must never be set on Vercel/production deployments.
const DEV_AUTH_BYPASS_EMAIL =
  process.env.NODE_ENV !== 'production' ? process.env.DEV_AUTH_BYPASS_EMAIL : undefined

export const getCurrentUser = cache(async () => {
  if (DEV_AUTH_BYPASS_EMAIL) {
    return prisma.user.findUnique({
      where: { email: DEV_AUTH_BYPASS_EMAIL },
      include: {
        vaProfile: true,
        profile: true,
        memberships: { include: { department: true, position: true } },
        roleAssignments: { where: { status: 'ACTIVE' } },
      },
    })
  }

  const supabase = await createServerSupabase()
  if (!supabase) {
    return null
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
})

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
  return requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')
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

// Returns the department ids a Dept/Ops Manager actively belongs to (and thus can
// manage teams/celebrants/clients within). Returns [] for full admins too — callers
// must branch on admin status separately (canMutate(user)/isAdmin) rather than
// treating an empty array as "no access" for an admin.
export function getManagedDepartmentIds(user: Awaited<ReturnType<typeof getCurrentUser>>): string[] {
  if (!user) return []
  return (user.memberships ?? []).filter((m) => !m.endedAt).map((m) => m.departmentId)
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
