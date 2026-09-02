import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LeaveRequestManager } from '@/components/leave/LeaveRequestManager'

export default async function LeavePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const requests = await prisma.leaveRequest.findMany({
    where: { userId: user.id },
    include: {
      actions: {
        include: { approver: { select: { firstName: true, lastName: true } } },
        orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Leave Requests</h2>
        <p className="text-xs text-muted-foreground">Request time off and track approval status.</p>
      </div>

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
    </div>
  )
}
