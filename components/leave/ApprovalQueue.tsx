'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CalendarCheck, Check, X } from 'lucide-react'
import { decideLeaveApprovalAction } from '@/app/(dashboard)/leave/actions'
import { ROLE_LABELS } from '@/lib/leave-roles'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  EMERGENCY: 'Emergency',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  UNPAID: 'Unpaid',
  BEREAVEMENT: 'Bereavement',
}

type ActionRow = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: string
  reason: string | null
  requesterName: string
  requesterRole: string
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function ApprovalQueue({ actions }: { actions: ActionRow[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [noteById, setNoteById] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleDecide = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    setBusyId(id)
    try {
      const res = await decideLeaveApprovalAction(id, decision, noteById[id] ?? '')
      if (res?.error) { toast.error(res.error); return }
      toast.success(decision === 'APPROVE' ? 'Approved' : 'Rejected')
      startTransition(() => router.refresh())
    } finally {
      setBusyId(null)
    }
  }

  if (actions.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <CalendarCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nothing waiting on your approval</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {actions.map((a) => (
        <div key={a.id} className="rounded-lg border bg-card p-4 space-y-2.5">
          <div>
            <p className="text-sm font-semibold">
              {a.requesterName} <span className="font-normal text-muted-foreground">({ROLE_LABELS[a.requesterRole] ?? a.requesterRole})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {LEAVE_TYPE_LABELS[a.leaveType] ?? a.leaveType} leave &middot; {fmt(a.startDate)} – {fmt(a.endDate)} &middot; {a.totalDays} working day{a.totalDays === '1' ? '' : 's'}
            </p>
            {a.reason && <p className="text-xs text-muted-foreground mt-1">&ldquo;{a.reason}&rdquo;</p>}
          </div>

          <Textarea
            placeholder="Optional note..."
            rows={2}
            className="text-xs"
            value={noteById[a.id] ?? ''}
            onChange={(e) => setNoteById((prev) => ({ ...prev, [a.id]: e.target.value }))}
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={busyId === a.id}
              onClick={() => handleDecide(a.id, 'APPROVE')}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 text-destructive"
              disabled={busyId === a.id}
              onClick={() => handleDecide(a.id, 'REJECT')}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
