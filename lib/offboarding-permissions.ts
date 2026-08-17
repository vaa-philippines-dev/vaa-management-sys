// Server-only — kept separate from lib/offboarding.ts (which is imported by
// the client component VAProfileEditor.tsx for its label constants) since
// this pulls in prisma/auth and would otherwise break the client bundle.
import { prisma } from '@/lib/prisma'
import { isDepartmentUnrestricted, getManagedDepartmentIds, hasModuleAccess, type getCurrentUser } from '@/lib/auth'
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
      const deptId = await vaPrimaryDepartmentId(vaUserId)
      return deptId !== null && getManagedDepartmentIds(user).includes(deptId)
    }
    case 'ACCOUNTING':
    case 'CUSTOMER_SUCCESS': {
      if (!CLEARANCE_MANAGER_ROLES.includes(user.systemRole)) return false
      const deptId = await departmentIdByAcronym(department === 'ACCOUNTING' ? 'ACCT' : 'CS')
      return deptId !== null && getManagedDepartmentIds(user).includes(deptId)
    }
    default:
      return false
  }
}
