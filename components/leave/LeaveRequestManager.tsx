'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Plus, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { submitLeaveRequest, cancelLeaveRequest } from '@/app/(dashboard)/leave/actions'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  EMERGENCY: 'Emergency',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  UNPAID: 'Unpaid',
  BEREAVEMENT: 'Bereavement',
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-warning/15 text-warning border-warning/20',
  APPROVED: 'bg-success/15 text-success border-success/20',
  REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
  CANCELLED: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
}

type ActionRow = {
  id: string
  stepOrder: number
  status: string
  note: string | null
  decidedAt: string | null
  approverName: string
}

type LeaveRequestRow = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: string
  reason: string | null
  status: string
  createdAt: string
  actions: ActionRow[]
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function LeaveRequestManager({ requests }: { requests: LeaveRequestRow[] }) {
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()
  const [, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" className="h-9 text-xs gap-1" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5" />
          Request Leave
        </Button>
      </div>

      {showForm && (
        <RequestLeaveModal
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false)
            startTransition(() => router.refresh())
          }}
        />
      )}

      {requests.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No leave requests yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType} Leave</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(r.startDate)} – {fmt(r.endDate)} &middot; {r.totalDays} working day{r.totalDays === '1' ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${STATUS_TONE[r.status] ?? ''}`}>
                    {r.status}
                  </Badge>
                  {r.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-destructive"
                      onClick={async () => {
                        if (!confirm('Cancel this leave request?')) return
                        const res = await cancelLeaveRequest(r.id)
                        if (res?.error) { toast.error(res.error); return }
                        toast.success('Leave request cancelled')
                        startTransition(() => router.refresh())
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    aria-label="Toggle approval timeline"
                  >
                    {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {r.reason && <p className="text-xs text-muted-foreground">&ldquo;{r.reason}&rdquo;</p>}

              {expandedId === r.id && (
                <div className="pt-2 border-t space-y-1.5">
                  {[...new Set(r.actions.map((a) => a.stepOrder))].sort((a, b) => a - b).map((step) => (
                    <div key={step} className="text-xs">
                      <span className="font-medium">Step {step}:</span>{' '}
                      <span className="text-muted-foreground">
                        {r.actions
                          .filter((a) => a.stepOrder === step)
                          .map((a) => `${a.approverName} (${a.status.toLowerCase()})${a.note ? ` — "${a.note}"` : ''}`)
                          .join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RequestLeaveModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Request Leave" size="sm">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setSubmitting(true)
          try {
            const fd = new FormData(e.currentTarget)
            const res = await submitLeaveRequest(fd)
            if (res?.error) { toast.error(res.error); return }
            toast.success('Leave request submitted')
            onSubmitted()
          } finally {
            setSubmitting(false)
          }
        }}
        className="space-y-3"
      >
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Leave Type *</label>
          <Select name="leaveType" defaultValue="VACATION" required className="h-9 text-sm">
            {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Start Date *</label>
            <Input type="date" name="startDate" required className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">End Date *</label>
            <Input type="date" name="endDate" required className="h-9 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Reason</label>
          <Textarea name="reason" rows={3} placeholder="Optional" className="text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" size="sm" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
        </div>
      </form>
    </Modal>
  )
}
