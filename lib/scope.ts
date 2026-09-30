import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, getManagedDepartmentIds, isDepartmentUnrestricted } from '@/lib/auth'

// Data scoping for every non-VA staff role, in one place.
//
// Three tiers:
//   • Full admins, HR and EXECUTIVE (view-only) see every department → `null`.
//   • Dept Manager, Operations Manager and Staff see the departments they hold
//     an active membership in → `{ departmentIds, userIds: null }`.
//   • Team Leader (the SystemRole) sees only the people on the teams they lead
//     (leader, temp leaders and active members), and only those people's work
//     inside those teams' departments → `{ departmentIds, userIds: [...] }`.
//     Being a member of the department is not enough: a TL doesn't see the
//     other teams' VAs, clients or assignments.
//
// VA-type users are scoped more tightly still (self / own team) by each page
// and are NOT covered here; callers branch on userType === 'VIRTUAL_ASSISTANT'
// first. (Most team leaders are VA accounts and take that branch.)
//
// Department ownership of each record:
//   Client      → client.departmentId
//   Assignment  → its client's departmentId (never the VA's memberships — a
//                 VA in PPC and Amazon has assignments in both, and PPC must
//                 not see the Amazon ones)
//   VA          → any active DepartmentMembership
//
// Empty arrays mean nothing is in scope and must match no rows, never fall
// through to everything.

type ScopeUser = Awaited<ReturnType<typeof getCurrentUser>>

export type Scope = null | {
  departmentIds: string[]
  // null = everyone in those departments; an array = only these people.
  userIds: string[] | null
}

export function canViewAllDepartments(user: ScopeUser): boolean {
  if (!user) return false
  return isDepartmentUnrestricted(user) || user.systemRole === 'EXECUTIVE'
}

export function isTeamScoped(user: ScopeUser): boolean {
  return !!user && user.systemRole === 'TEAM_LEADER' && user.userType !== 'VIRTUAL_ASSISTANT'
}

// The teams a user leads (leader or either temp-leader slot), and everyone on
// them. Cached per request — most pages resolve scope more than once.
export const getLedTeamScope = cache(async (userId: string) => {
  const teams = await prisma.team.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ leaderId: userId }, { tempLeader1Id: userId }, { tempLeader2Id: userId }],
    },
    select: {
      id: true,
      departmentId: true,
      leaderId: true,
      tempLeader1Id: true,
      tempLeader2Id: true,
      memberships: { where: { endedAt: null }, select: { userId: true } },
    },
  })
  const userIds = new Set<string>([userId])
  for (const t of teams) {
    for (const id of [t.leaderId, t.tempLeader1Id, t.tempLeader2Id]) if (id) userIds.add(id)
    for (const m of t.memberships) userIds.add(m.userId)
  }
  return {
    teamIds: teams.map((t) => t.id),
    departmentIds: [...new Set(teams.map((t) => t.departmentId))],
    userIds: [...userIds],
  }
})

async function resolveScope(user: ScopeUser, unrestricted: boolean): Promise<Scope> {
  if (!user) return { departmentIds: [], userIds: [] }
  if (unrestricted) return null
  if (isTeamScoped(user)) {
    const team = await getLedTeamScope(user.id)
    return { departmentIds: team.departmentIds, userIds: team.userIds }
  }
  return { departmentIds: getManagedDepartmentIds(user), userIds: null }
}

// For reads. EXECUTIVE included (the COO needs the company view).
export function getViewScope(user: ScopeUser): Promise<Scope> {
  return resolveScope(user, canViewAllDepartments(user))
}

// For writes. EXECUTIVE is view-only and can't reach a mutation anyway, so the
// only difference from getViewScope() is intent at the call site.
export function getMutateScope(user: ScopeUser): Promise<Scope> {
  return resolveScope(user, !!user && isDepartmentUnrestricted(user))
}

// ── Small helpers ──────────────────────────────────────────────────────

export function scopeDepartmentIds(scope: Scope): string[] | null {
  return scope === null ? null : scope.departmentIds
}

export function isDepartmentInScope(scope: Scope, departmentId: string | null | undefined): boolean {
  if (scope === null) return true
  return !!departmentId && scope.departmentIds.includes(departmentId)
}

export function isUserInScope(scope: Scope, userId: string | null | undefined): boolean {
  if (scope === null || scope.userIds === null) return true
  return !!userId && scope.userIds.includes(userId)
}

// Cache keys MUST use this rather than the department ids alone — a Team
// Leader and their Dept Manager share department ids but not visibility.
export function scopeKey(scope: Scope): string {
  if (scope === null) return 'all'
  const d = [...scope.departmentIds].sort().join(',')
  return scope.userIds === null ? `d:${d}` : `d:${d}|u:${[...scope.userIds].sort().join(',')}`
}

// ── Prisma where-fragments ─────────────────────────────────────────────

export function assignmentScopeWhere(scope: Scope): Prisma.AssignmentWhereInput {
  if (scope === null) return {}
  return {
    client: { departmentId: { in: scope.departmentIds } },
    ...(scope.userIds !== null && { vaProfile: { userId: { in: scope.userIds } } }),
  }
}

// Team scope: only clients a team member actually works for in that department.
export function clientScopeWhere(scope: Scope): Prisma.ClientWhereInput {
  if (scope === null) return {}
  return {
    departmentId: { in: scope.departmentIds },
    ...(scope.userIds !== null && { assignments: { some: assignmentScopeWhere(scope) } }),
  }
}

export function userScopeWhere(scope: Scope): Prisma.UserWhereInput {
  if (scope === null) return {}
  return {
    memberships: { some: { departmentId: { in: scope.departmentIds }, endedAt: null } },
    ...(scope.userIds !== null && { id: { in: scope.userIds } }),
  }
}

export function vaProfileScopeWhere(scope: Scope): Prisma.VAProfileWhereInput {
  return scope === null ? {} : { user: userScopeWhere(scope) }
}

// ── Guards (throw on out-of-scope) ─────────────────────────────────────

const FORBIDDEN = 'Forbidden: outside your scope'

export function assertDepartmentInScope(scope: Scope, departmentId: string | null | undefined) {
  if (!isDepartmentInScope(scope, departmentId)) throw new Error(FORBIDDEN)
}

export async function assertClientInScope(scope: Scope, clientId: string) {
  if (scope === null) return
  const count = await prisma.client.count({ where: { id: clientId, ...clientScopeWhere(scope) } })
  if (count === 0) throw new Error(FORBIDDEN)
}

export async function assertAssignmentInScope(scope: Scope, assignmentId: string) {
  if (scope === null) return
  const count = await prisma.assignment.count({ where: { id: assignmentId, ...assignmentScopeWhere(scope) } })
  if (count === 0) throw new Error(FORBIDDEN)
}

export async function assertVAProfileInScope(scope: Scope, vaProfileId: string) {
  if (!(await isVAProfileInScope(scope, vaProfileId))) throw new Error(FORBIDDEN)
}

export async function assertUserInScope(scope: Scope, userId: string) {
  if (scope === null) return
  const count = await prisma.user.count({ where: { id: userId, ...userScopeWhere(scope) } })
  if (count === 0) throw new Error(FORBIDDEN)
}

// Non-throwing variant for pages, which should notFound() rather than error.
export async function isVAProfileInScope(scope: Scope, vaProfileId: string) {
  if (scope === null) return true
  return (await prisma.vAProfile.count({ where: { id: vaProfileId, ...vaProfileScopeWhere(scope) } })) > 0
}
