import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

export const CLIENT_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF', 'HR']
export const ASSIGNMENT_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF', 'HR']
export const VA_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'HR']
// Ticketing: only admins can view every ticket and manage them (assign/close/resolve).
// EXECUTIVE can view every ticket but not mutate it (view-only, same as requireAdminMutator()).
// Everyone else (DEPT_MANAGER, STAFF, VA) only sees tickets they created or are assigned to.
export const TICKET_VIEW_ALL_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']
export const TICKET_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN']
// Dept Manager / Operations Manager — scoped to their own department(s) via
// getManagedDepartmentIds() rather than seeing every department unscoped.
// Previously copy-pasted locally in vas/page.tsx and clients/page.tsx.
export const DEPARTMENT_SCOPED_ROLES = ['DEPT_MANAGER', 'OPERATIONS_MANAGER']
// Team creation + membership composition (add/remove/transfer) — Dept Manager owns team composition.
// HR also gets this, elevated to an unscoped (all-department) grant — see assertDepartmentManaged() in teams/actions.ts.
export const TEAM_MANAGE_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'HR']
// Team Leader + both Temp Leader slots — Operations Manager owns who leads, not who's on the roster.
// HR is deliberately added here too (elevated beyond Dept Manager, who does NOT get this) per HR's expanded team-assignment mandate.
export const TEAM_LEADER_ASSIGN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'OPERATIONS_MANAGER', 'HR']
// AI Agent suggestions (VA matches, onboarding drafts, stalled-handoff flags):
// deciding on one is a real staffing/onboarding call, owned by the same roles
// that manage departments and staffing day-to-day. EXECUTIVE (e.g. the COO)
// can view this page via requireManager() but is deliberately excluded here —
// view-only, same principle as requireAdminMutator().
export const AGENT_MUTATOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'OPERATIONS_MANAGER', 'HR']
// Who can configure the Leave Approval Hierarchy (which roles/users approve whose
// leave). Deciding the company's approval chain is an HR/admin policy call, not a
// day-to-day manager one — same tier as TEAM_MANAGE_ROLES minus DEPT_MANAGER.
export const LEAVE_ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'HR']
// Deleting an offboarding case is destructive and permanent (unlike the rest of
// VA_MUTATOR_ROLES's day-to-day workflow actions on it), so it's scoped tighter:
// full admins plus HR, who own the Offboarding module end-to-end.
export const OFFBOARDING_DELETE_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'HR']
// A VA's Personal Information, Employment & Payment, and 201 Files/attachments
// are sensitive employee data — per HR feedback, only HR + full admins may edit
// these specific sections. Dept/Ops Managers and Team Leaders (who otherwise
// sit in VA_MUTATOR_ROLES) drop to view-only here; every other VA_MUTATOR_ROLES
// section (address, socials, skills, status, offboarding) is unaffected.
export const VA_SENSITIVE_INFO_EDIT_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'HR']
// 2026-08-19 HR meeting: HR must be able to override a Team-Leader-initiated
// resignation, since VA_MUTATOR_ROLES otherwise treats every resignation
// actor as equal. Used by logDiscussionOutcome() to let HR/admins re-log the
// TL-VA discussion outcome after it's already locked (e.g. to correct a
// mistaken entry) — everyone else still gets exactly one shot at it.
export const RESIGNATION_OVERRIDE_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'HR']

// "View as" — lets a full admin (SUPER_ADMIN/SYSTEM_ADMIN) or HR temporarily browse
// the app simulating another SystemRole, via a cookie read in getCurrentUser() below.
// Deliberately excludes SUPER_ADMIN/SYSTEM_ADMIN as targets (no viewing-as into
// another full admin) — HR itself can still be simulated/impersonated like any other role.
export const VIEW_AS_ROLES = ['EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'HR', 'STAFF', 'VA'] as const
export type ViewAsRole = (typeof VIEW_AS_ROLES)[number]
// HR owns Leave/Offboarding end-to-end (see LEAVE_ADMIN_ROLES/OFFBOARDING_DELETE_ROLES
// above) and needs to test those flows as the roles that actually use them — granted
// the same "view as" access as full admins rather than a narrower carve-out.
export const VIEW_AS_GRANTOR_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'HR']
export const VIEW_AS_COOKIE = 'view_as_role'
// Dept Manager is department-scoped (see getManagedDepartmentIds() below), but the
// real admin doing the simulating typically has no DepartmentMembership rows of
// their own — so simulating the role alone renders every department-scoped page
// (clients/VAs/teams/celebrants) empty. This second cookie lets the admin also pick
// *which* department to preview as its manager.
export const VIEW_AS_DEPARTMENT_COOKIE = 'view_as_department_id'
// Narrows "view as <role>" from a generic role simulation to one specific real
// account of that role — id/email/vaProfile/memberships all come from that real
// user instead of the admin's, so Server Actions (e.g. submitting a leave
// request) genuinely act as that person rather than being stamped with the
// admin's own id. See setViewAsUser() in app/(dashboard)/_view-as/actions.ts.
export const VIEW_AS_USER_COOKIE = 'view_as_user_id'

// Dev-only auth bypass for local testing of multi-user flows (e.g. Inbox
// realtime) without needing two real Google OAuth logins. Only ever active
// when NODE_ENV !== 'production' AND DEV_AUTH_BYPASS_EMAIL is set locally —
// this env var must never be set on Vercel/production deployments.
const DEV_AUTH_BYPASS_EMAIL =
  process.env.NODE_ENV !== 'production' ? process.env.DEV_AUTH_BYPASS_EMAIL : undefined

const getRealCurrentUser = cache(async () => {
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

// Wraps getRealCurrentUser() with the "view as" override: when the real user is a full
// admin or HR (see VIEW_AS_GRANTOR_ROLES) and a valid VIEW_AS_COOKIE is set, every
// downstream requireRole()/requireAdminMutator()/canMutate() etc. call sees the
// simulated systemRole instead of the real one — a genuine permission simulation, not
// just a UI relabel. realSystemRole/isViewingAs stay attached so the navbar can
// show/exit the simulation regardless of which role is currently active.
export const getCurrentUser = cache(async () => {
  const realUser = await getRealCurrentUser()
  if (!realUser) return null

  const canViewAs = (VIEW_AS_GRANTOR_ROLES as readonly string[]).includes(realUser.systemRole)
  const cookieStore = await cookies()
  const viewAsRole = canViewAs ? cookieStore.get(VIEW_AS_COOKIE)?.value : undefined
  const isViewingAs = !!viewAsRole && (VIEW_AS_ROLES as readonly string[]).includes(viewAsRole)

  // See VIEW_AS_DEPARTMENT_COOKIE above — only meaningful while simulating Dept
  // Manager. getManagedDepartmentIds()/getPrimaryDepartment() special-case it.
  let viewAsDepartment = null as Awaited<ReturnType<typeof prisma.department.findUnique>> | null
  if (isViewingAs && viewAsRole === 'DEPT_MANAGER') {
    const deptId = cookieStore.get(VIEW_AS_DEPARTMENT_COOKIE)?.value
    if (deptId) {
      viewAsDepartment = await prisma.department.findUnique({ where: { id: deptId } })
    }
  }

  // See VIEW_AS_USER_COOKIE above — when set, the real admin's own id/email/
  // vaProfile/memberships are swapped out entirely for that account's, so writes
  // (leave requests, etc.) are genuinely owned by them instead of the admin.
  // Only honored when it matches the currently simulated role, so switching
  // roles (setViewAsRole) can't leave a stale account swap in effect. Falls back
  // to the plain role simulation below if the cookie is stale (e.g. the account
  // was deleted).
  let viewAsUser: Awaited<ReturnType<typeof getRealCurrentUser>> | null = null
  if (isViewingAs) {
    const viewAsUserId = cookieStore.get(VIEW_AS_USER_COOKIE)?.value
    if (viewAsUserId) {
      viewAsUser = await prisma.user.findUnique({
        where: { id: viewAsUserId, systemRole: viewAsRole as ViewAsRole },
        include: {
          vaProfile: true,
          profile: true,
          memberships: { include: { department: true, position: true } },
          roleAssignments: { where: { status: 'ACTIVE' } },
        },
      })
    }
  }
  const identity = viewAsUser ?? realUser

  return {
    ...identity,
    systemRole: isViewingAs ? (viewAsRole as ViewAsRole) : identity.systemRole,
    // Simulating VA must also flip userType — a large chunk of VA-scoping logic
    // (sidebar nav, work logs/assignments/clients/vas scoping, dashboard, celebrants,
    // teams) branches on userType === 'VIRTUAL_ASSISTANT', not systemRole. Without this,
    // "view as VA" only fools systemRole-gated pages and leaves everything else showing
    // the real admin's unscoped view.
    userType: isViewingAs && viewAsRole === 'VA' ? 'VIRTUAL_ASSISTANT' : identity.userType,
    realSystemRole: realUser.systemRole,
    realUserId: realUser.id,
    isViewingAs,
    // True only when a specific VA account was picked (viewAsUser above) — id/email/
    // vaProfile all belong to that VA, not the admin. False for the plain role-only
    // simulation used by every other VIEW_AS_ROLES entry.
    isViewingAsAccount: !!viewAsUser,
    viewAsDepartment,
    viewAsDepartmentId: viewAsDepartment?.id ?? null,
  }
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

// Roles that see every department unscoped, same as full admins. Dept/Ops Manager
// stay scoped to getManagedDepartmentIds(), but HR is deliberately elevated to an
// all-department view (teams, celebrants) — use this instead of canMutate() wherever
// a module branches "admin sees all / manager sees own department(s)".
export function isDepartmentUnrestricted(user: { systemRole: string } | null | undefined): boolean {
  if (!user) return false
  return canMutate(user) || user.systemRole === 'HR'
}

export async function requireManager() {
  return requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'HR')
}

export async function requireVA() {
  const user = await requireAuth()
  if (user.userType !== 'VIRTUAL_ASSISTANT') throw new Error('Forbidden')
  return user
}

export function getPrimaryDepartment(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return null
  if (user.viewAsDepartment) return user.viewAsDepartment
  const primary = user.memberships?.find((m) => m.isPrimary)
  return primary?.department ?? user.memberships?.[0]?.department ?? null
}

// Returns the department ids a Dept/Ops Manager actively belongs to (and thus can
// manage teams/celebrants/clients within). Returns [] for full admins too — callers
// must branch on admin status separately (canMutate(user)/isAdmin) rather than
// treating an empty array as "no access" for an admin.
//
// While simulating Dept Manager via "view as" (see VIEW_AS_DEPARTMENT_COOKIE), the
// chosen department wins over the real user's own memberships — otherwise this
// would fall back to the admin's (usually empty) membership list and every
// department-scoped page would render empty.
export function getManagedDepartmentIds(user: Awaited<ReturnType<typeof getCurrentUser>>): string[] {
  if (!user) return []
  if (user.viewAsDepartmentId) return [user.viewAsDepartmentId]
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
