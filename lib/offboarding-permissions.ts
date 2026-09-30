// Server-only — kept separate from lib/offboarding.ts (which is imported by
// the client component VAProfileEditor.tsx for its label constants) since
// this pulls in prisma/auth and would otherwise break the client bundle.
import { prisma } from '@/lib/prisma'
import { isDepartmentUnrestricted, canMutate, getManagedDepartmentIds, hasModuleAccess, type getCurrentUser } from '@/lib/auth'
import { getMutateScope, isDepartmentInScope, isUserInScope } from '@/lib/scope'
import type { ExitClearanceDepartment } from '@/src/generated/prisma/enums'

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>

const CLEARANCE_MANAGER_ROLES = ['DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER']

async function departmentIdByAcronym(acronym: string): Promise<string | null> {
  const dept = await prisma.department.findFirst({ where: { acronym }, select: { id: true } })
  return dept?.id ?? null
}

async function vaPrimaryDepartmentId(vaUserId: string): Promise<string | null> {
  const membership = await prisma.departmentMembership.findFirst({
    where: { userId: vaUserId, endedAt: null, isPrimary: true },
    select: { departmentId: true },
  })
  return membership?.departmentId ?? null
}

// Per-department approver check for the 5-way Exit Clearance (BR-06) — the
// existing flat VA_MUTATOR_ROLES gate on the legacy single-checklist
// ExitClearance is fine for one checklist, but wrong here: no single
// department should be able to unilaterally clear all 5.
export async function canApproveClearanceDepartment(
  user: CurrentUser,
  department: ExitClearanceDepartment,
  vaUserId: string
): Promise<boolean> {
  if (!user) return false
  // Admins + HR (isDepartmentUnrestricted) see/approve everything, including
  // the HR row itself — matches the real HR-Manager/VA-Relations overlap.
  if (isDepartmentUnrestricted(user)) return true

  switch (department) {
    case 'HR':
      return false
    case 'TRAINING':
      // No Training Department row exists — a department-agnostic grant
      // instead, since there's no natural department scope for it.
      return hasModuleAccess(user, 'exit-clearance-training', 'approve')
    case 'SERVICE_DEPARTMENT': {
      if (!CLEARANCE_MANAGER_ROLES.includes(user.systemRole)) return false
      // The VA's own Service Department: lib/scope.ts decides, so a Team
      // Leader only approves for people on the teams they lead.
      const [deptId, scope] = await Promise.all([vaPrimaryDepartmentId(vaUserId), getMutateScope(user)])
      return deptId !== null && isDepartmentInScope(scope, deptId) && isUserInScope(scope, vaUserId)
    }
    case 'ACCOUNTING':
    case 'CUSTOMER_SUCCESS': {
      if (!CLEARANCE_MANAGER_ROLES.includes(user.systemRole)) return false
      // Approver standing here comes from membership in ACCT/CS itself, not
      // from the VA being in the approver's scope — deliberately unchanged.
      const deptId = await departmentIdByAcronym(department === 'ACCOUNTING' ? 'ACCT' : 'CS')
      return deptId !== null && getManagedDepartmentIds(user).includes(deptId)
    }
    default:
      return false
  }
}

// FB-0002 (2026-09 HR feedback): Type A (EOC) / Type B (CLIENT_INITIATED)
// terminations belong to Customer Success and the VA's own Service Department,
// not HR — unlike VA_MUTATOR_ROLES' blanket access, this deliberately excludes
// HR from *initiating* these two types (they keep read access everywhere else).
// Uses canMutate() (not isDepartmentUnrestricted()) for the full-admin bypass
// since that helper also includes HR, which would defeat the restriction.
export async function canInitiateEocOrClientInitiatedTermination(
  user: CurrentUser,
  vaUserId: string
): Promise<boolean> {
  if (!user) return false
  if (canMutate(user)) return true
  if (!CLEARANCE_MANAGER_ROLES.includes(user.systemRole)) return false

  // Own Service Department path follows lib/scope.ts (a Team Leader: only
  // their teams' people); the Customer Success path stays membership-based.
  const managed = getManagedDepartmentIds(user)
  const [ownDeptId, csDeptId, scope] = await Promise.all([
    vaPrimaryDepartmentId(vaUserId),
    departmentIdByAcronym('CS'),
    getMutateScope(user),
  ])
  return (
    (ownDeptId !== null && isDepartmentInScope(scope, ownDeptId) && isUserInScope(scope, vaUserId)) ||
    (csDeptId !== null && managed.includes(csDeptId))
  )
}
