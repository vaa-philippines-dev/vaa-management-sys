import { prisma } from '@/lib/prisma'
import { getCurrentUser, LEAVE_ADMIN_ROLES } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LEAVE_ROLE_OPTIONS, ROLE_LABELS } from '@/lib/leave-roles'
import { LeaveHierarchyManager } from '@/components/admin/LeaveHierarchyManager'

export default async function LeaveHierarchyPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!LEAVE_ADMIN_ROLES.includes(user.systemRole)) redirect('/dashboard')

  const [rules, users] = await Promise.all([
    prisma.leaveApprovalRule.findMany({
      where: { submitterRole: { in: [...LEAVE_ROLE_OPTIONS] } },
      include: { steps: { orderBy: { order: 'asc' } } },
    }),
    prisma.user.findMany({
      where: { isActive: true, userType: 'INTERNAL_STAFF' },
      select: { id: true, firstName: true, lastName: true, email: true, systemRole: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ])

  const rulesByRole = new Map(rules.map((r) => [r.submitterRole, r]))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Leave Approval Hierarchy</h2>
        <p className="text-xs text-muted-foreground">
          Configure who must approve leave requests for each role — e.g. a Team Leader&apos;s leave needs the
          department head and HR; a Dept Manager&apos;s leave needs HR and named executives.
        </p>
      </div>

      <LeaveHierarchyManager
        roles={LEAVE_ROLE_OPTIONS.map((role) => ({
          role,
          label: ROLE_LABELS[role] ?? role,
          rule: rulesByRole.get(role)
            ? {
                isActive: rulesByRole.get(role)!.isActive,
                steps: rulesByRole.get(role)!.steps.map((s) => ({
                  order: s.order,
                  resolution: s.resolution,
                  approverRole: s.approverRole,
                  approverUserId: s.approverUserId,
                  requireAll: s.requireAll,
                })),
              }
            : null,
        }))}
        users={users}
      />
    </div>
  )
}
