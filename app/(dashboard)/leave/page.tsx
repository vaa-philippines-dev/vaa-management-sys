import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, LEAVE_DEPARTMENT_VIEW_ROLES } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LeaveRequestManager } from '@/components/leave/LeaveRequestManager'
import { DepartmentLeaveTable } from '@/components/leave/DepartmentLeaveTable'
import { getDepartmentLeaveRequests, LEAVE_DEPARTMENT_LOOKBACK_DAYS } from '@/lib/leave'
import { canViewAllDepartments, isTeamScoped } from '@/lib/scope'

export default async function LeavePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // Staff Leave Management only — VAs have their own contract/availability
  // model and can't file leave here yet.
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const { view } = await searchParams
  const canViewDepartment = LEAVE_DEPARTMENT_VIEW_ROLES.includes(user.systemRole)
  const showDepartment = canViewDepartment && view === 'department'
  const departmentLabel = canViewAllDepartments(user)
    ? 'All staff'
    : isTeamScoped(user)
      ? 'My teams'
      : 'My department'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Leave Requests</h2>
        <p className="text-xs text-muted-foreground">
          {showDepartment
            ? `Staff leave in ${canViewAllDepartments(user) ? 'every department' : isTeamScoped(user) ? 'the teams you lead' : 'your department'} — pending, plus the last ${LEAVE_DEPARTMENT_LOOKBACK_DAYS} days.`
            : 'Request time off and track approval status.'}
        </p>
      </div>

      {canViewDepartment && (
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'mine', label: 'My requests', href: '/leave' },
            { key: 'department', label: departmentLabel, href: '/leave?view=department' },
          ].map((t) => {
            const active = (t.key === 'department') === showDepartment
            return (
              <Link
                key={t.key}
                href={t.href}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      )}

      {showDepartment ? (
        <DepartmentLeaveTable rows={await getDepartmentLeaveRequests(user)} />
      ) : (
        <MyLeaveRequests userId={user.id} />
      )}
    </div>
  )
}

async function MyLeaveRequests({ userId }: { userId: string }) {
  const requests = await prisma.leaveRequest.findMany({
    where: { userId },
    include: {
      actions: {
        include: { approver: { select: { firstName: true, lastName: true } } },
        orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <LeaveRequestManager
      requests={requests.map((r) => ({
        id: r.id,
        leaveType: r.leaveType,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        totalDays: r.totalDays.toString(),
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        actions: r.actions.map((a) => ({
          id: a.id,
          stepOrder: a.stepOrder,
          status: a.status,
          note: a.note,
          decidedAt: a.decidedAt?.toISOString() ?? null,
          approverName: `${a.approver.firstName} ${a.approver.lastName}`,
        })),
      }))}
    />
  )
}
