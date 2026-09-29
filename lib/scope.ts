import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, getManagedDepartmentIds, isDepartmentUnrestricted } from '@/lib/auth'

// Department scoping for every non-VA staff role, in one place.
//
// The rule: full admins, HR and EXECUTIVE (view-only) see every department.
// Everyone else — Dept Manager, Operations Manager, Team Leader, Staff — sees
// only the departments they hold an active membership in. VA-type users are
// scoped more tightly still (self / own team) by each page and are NOT
// covered here; callers branch on userType === 'VIRTUAL_ASSISTANT' first.
//
// Department ownership of each record:
//   Client      → client.departmentId
//   Assignment  → its client's departmentId (never the VA's memberships — a
//                 VA in PPC and Amazon has assignments in both, and PPC must
//                 not see the Amazon ones)
//   VA          → any active DepartmentMembership
//
// The helpers return `null` for "every department" and an array otherwise;
// an empty array means nothing is in scope and must match no rows, never
// fall through to everything.

type ScopeUser = Awaited<ReturnType<typeof getCurrentUser>>

export function canViewAllDepartments(user: ScopeUser): boolean {
  if (!user) return false
  return isDepartmentUnrestricted(user) || user.systemRole === 'EXECUTIVE'
}

// For reads. EXECUTIVE included (the COO needs the company view).
export function getViewableDepartmentIds(user: ScopeUser): string[] | null {
  if (canViewAllDepartments(user)) return null
  return getManagedDepartmentIds(user)
}

// For writes. EXECUTIVE is view-only and can't reach a mutation anyway, so the
// only difference from getViewableDepartmentIds() is intent at the call site.
export function getMutableDepartmentIds(user: ScopeUser): string[] | null {
  if (!user) return []
  if (isDepartmentUnrestricted(user)) return null
  return getManagedDepartmentIds(user)
}

// ── Prisma where-fragments ─────────────────────────────────────────────

export function clientScopeWhere(ids: string[] | null): Prisma.ClientWhereInput {
  return ids === null ? {} : { departmentId: { in: ids } }
}

export function assignmentScopeWhere(ids: string[] | null): Prisma.AssignmentWhereInput {
  return ids === null ? {} : { client: { departmentId: { in: ids } } }
}

export function vaProfileScopeWhere(ids: string[] | null): Prisma.VAProfileWhereInput {
  return ids === null
    ? {}
    : { user: { memberships: { some: { departmentId: { in: ids }, endedAt: null } } } }
}

export function userScopeWhere(ids: string[] | null): Prisma.UserWhereInput {
  return ids === null ? {} : { memberships: { some: { departmentId: { in: ids }, endedAt: null } } }
}

// ── Guards (throw on out-of-scope) ─────────────────────────────────────

const FORBIDDEN = 'Forbidden: outside your department scope'

export function assertDepartmentInScope(ids: string[] | null, departmentId: string | null | undefined) {
  if (ids === null) return
  if (!departmentId || !ids.includes(departmentId)) throw new Error(FORBIDDEN)
}

export async function assertClientInScope(ids: string[] | null, clientId: string) {
  if (ids === null) return
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { departmentId: true } })
  if (!client) throw new Error('Client not found')
  assertDepartmentInScope(ids, client.departmentId)
}

export async function assertAssignmentInScope(ids: string[] | null, assignmentId: string) {
  if (ids === null) return
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { client: { select: { departmentId: true } } },
  })
  if (!a) throw new Error('Assignment not found')
  assertDepartmentInScope(ids, a.client.departmentId)
}

export async function assertVAProfileInScope(ids: string[] | null, vaProfileId: string) {
  if (ids === null) return
  const count = await prisma.vAProfile.count({ where: { id: vaProfileId, ...vaProfileScopeWhere(ids) } })
  if (count === 0) throw new Error(FORBIDDEN)
}

export async function assertUserInScope(ids: string[] | null, userId: string) {
  if (ids === null) return
  const count = await prisma.user.count({ where: { id: userId, ...userScopeWhere(ids) } })
  if (count === 0) throw new Error(FORBIDDEN)
}

// Non-throwing variants for pages, which should notFound() rather than error.
export async function isVAProfileInScope(ids: string[] | null, vaProfileId: string) {
  if (ids === null) return true
  return (await prisma.vAProfile.count({ where: { id: vaProfileId, ...vaProfileScopeWhere(ids) } })) > 0
}
