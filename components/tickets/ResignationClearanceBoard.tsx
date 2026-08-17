'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { actOnClearanceApproval } from '@/app/(dashboard)/vas/actions'
import { EXIT_CLEARANCE_DEPARTMENT_LABELS, CLEARANCE_APPROVAL_STATUS_LABELS } from '@/lib/offboarding'

type ApprovalRow = {
  id: string
  department: string
  status: string
  comments: string | null
  approverName: string | null
  actionDate: string | null
  checklistItems: { label: string; checked: boolean }[]
}

function statusVariant(status: string): 'default' | 'destructive' | 'outline' {
  if (status === 'APPROVED') return 'default'
  if (status === 'REJECTED') return 'destructive'
  return 'outline'
}

// 5-card board for the Exit Clearance's independent department sign-offs
// (BR-06) — each card only shows an Approve/Reject form to a viewer who can
// actually act on that department (canApproveClearanceDepartment); the
// server action re-checks regardless, so this is UX-only, not the security
// boundary. A rejection only reopens that one card — the others are
// unaffected.
export function ResignationClearanceBoard({
  approvals,
  approvableDepartments,
}: {
  approvals: ApprovalRow[]
  approvableDepartments: Set<string>
}) {
  const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        {approvedCount} of {approvals.length} approved
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {approvals.map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} canApprove={approvableDepartments.has(approval.department)} />
        ))}
      </div>
    </div>
  )
}

function ApprovalCard({ approval, canApprove }: { approval: ApprovalRow; canApprove: boolean }) {
  const [comments, setComments] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = (status: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('status', status)
      fd.set('comments', comments)
      await actOnClearanceApproval(approval.id, fd)
    })
  }

  return (
    <Card className={approval.status === 'REJECTED' ? 'border-destructive/40' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          {EXIT_CLEARANCE_DEPARTMENT_LABELS[approval.department] ?? approval.department}
          <Badge variant={statusVariant(approval.status)} className="text-[10px]">
            {CLEARANCE_APPROVAL_STATUS_LABELS[approval.status] ?? approval.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <ul className="space-y-0.5 text-muted-foreground">
          {approval.checklistItems.map((item, i) => (
            <li key={i}>• {item.label}</li>
          ))}
        </ul>
        {approval.comments && <p className="text-destructive italic">{approval.comments}</p>}
        {approval.approverName && approval.actionDate && (
          <p className="text-muted-foreground">
            {approval.approverName} · {new Date(approval.actionDate).toLocaleString()}
          </p>
        )}
        {approval.status === 'PENDING' && canApprove && (
          <div className="space-y-2 pt-1">
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Comments (required if rejecting)"
              className="min-h-12 text-xs"
              disabled={isPending}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" className="flex-1" disabled={isPending} onClick={() => submit('APPROVED')}>
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => submit('REJECTED')}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
