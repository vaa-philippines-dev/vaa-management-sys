import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ApprovalQueue } from '@/components/leave/ApprovalQueue'

export default async function LeaveApprovalsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Actions are only ever created for a request's *current* step (see
  // openStep() in leave/actions.ts — the previous step's rows are cancelled
  // once it advances), so "pending and assigned to me" is already exactly
  // "actionable by me right now," no extra step-matching needed.
  const actions = await prisma.leaveApprovalAction.findMany({
    where: { approverId: user.id, status: 'PENDING' },
    include: {
      leaveRequest: { include: { user: { select: { firstName: true, lastName: true, systemRole: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Leave Approvals</h2>
        <p className="text-xs text-muted-foreground">Leave requests waiting on your approval.</p>
      </div>

      <ApprovalQueue
        actions={actions.map((a) => ({
          id: a.id,
          leaveType: a.leaveRequest.leaveType,
          startDate: a.leaveRequest.startDate.toISOString(),
          endDate: a.leaveRequest.endDate.toISOString(),
          totalDays: a.leaveRequest.totalDays.toString(),
          reason: a.leaveRequest.reason,
          requesterName: `${a.leaveRequest.user.firstName} ${a.leaveRequest.user.lastName}`,
          requesterRole: a.leaveRequest.user.systemRole,
        }))}
      />
    </div>
  )
}
