import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EXIT_CLEARANCE_DEPARTMENT_LABELS, CLEARANCE_APPROVAL_STATUS_LABELS } from '@/lib/offboarding'
import { ClearanceApprovalForm } from '@/components/exit-clearance/ClearanceApprovalForm'

export default async function ExitClearancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const approval = await prisma.exitClearanceApproval.findUnique({
    where: { token },
    include: {
      termination: {
        include: {
          vaProfile: { include: { user: true } },
          clearanceApprovals: {
            include: { approver: { select: { firstName: true, email: true } } },
            orderBy: { department: 'asc' },
          },
        },
      },
    },
  })

  const invalidReason = !approval
    ? 'This approval link is invalid.'
    : approval.termination.workflowStatus !== 'CLEARANCE_PROCESSING'
      ? 'This clearance is no longer open — the case has moved past this stage.'
      : null

  if (invalidReason || !approval) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link no longer works</CardTitle>
            <CardDescription>{invalidReason}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Contact HR if you believe this is a mistake.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { user } = approval.termination.vaProfile
  const vaName = `${user.firstName} ${user.lastName}`.trim()
  const checklistItems = Array.isArray(approval.checklistItems)
    ? (approval.checklistItems as { label: string; checked: boolean }[])
    : []

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Exit Clearance — {EXIT_CLEARANCE_DEPARTMENT_LABELS[approval.department] ?? approval.department}</CardTitle>
          <CardDescription>
            Clearing {vaName}&apos;s exit for your department — no account or login needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">All Departments</p>
            <div className="space-y-1.5">
              {approval.termination.clearanceApprovals.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-md bg-muted/40">
                  <span>{EXIT_CLEARANCE_DEPARTMENT_LABELS[a.department] ?? a.department}</span>
                  <div className="flex items-center gap-2">
                    {a.status !== 'PENDING' && (a.approverName || a.approver) && (
                      <span className="text-xs text-muted-foreground">
                        {a.approverName || a.approver?.firstName || a.approver?.email}
                      </span>
                    )}
                    <Badge variant={a.status === 'APPROVED' ? 'secondary' : a.status === 'REJECTED' ? 'destructive' : 'outline'}>
                      {CLEARANCE_APPROVAL_STATUS_LABELS[a.status] ?? a.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {approval.status !== 'PENDING' ? (
            <p className="text-sm text-muted-foreground">
              You already submitted this department&apos;s decision ({CLEARANCE_APPROVAL_STATUS_LABELS[approval.status]}). No further action is needed.
            </p>
          ) : (
            <ClearanceApprovalForm token={token} checklistItems={checklistItems} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
