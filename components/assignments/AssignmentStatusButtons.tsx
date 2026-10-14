'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { updateAssignmentStatus } from '@/app/(dashboard)/assignments/actions'
import { ASSIGNMENT_STATUS_REASONS, ASSIGNMENT_STATUS_REASON_LABELS } from '@/lib/assignment-status-fields'

// Button label per target status — the action, not the raw enum.
const ACTION_LABELS: Record<string, string> = {
  ACTIVE: 'Resume',
  PAUSED: 'Pause',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancel',
}

const DATE_LABELS: Record<string, string> = {
  ACTIVE: 'Reactivated on',
  PAUSED: 'Paused on',
  COMPLETED: 'Completed on',
  CANCELLED: 'Cancelled on',
}

const TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: ['ACTIVE'],
}

// The viewer's own calendar date — toISOString() would be yesterday's in
// Manila until 8AM.
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function actionLabel(current: string, target: string) {
  return (current === 'CANCELLED' || current === 'PAUSED') && target === 'ACTIVE' ? 'Reactivate' : ACTION_LABELS[target]
}

export function AssignmentStatusButtons({ id, current }: { id: string; current: string }) {
  const options = TRANSITIONS[current] ?? []
  const [target, setTarget] = useState<string | null>(null)

  if (options.length === 0) return null

  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button key={s} type="button" size="sm" variant="outline" onClick={() => setTarget(s)}>
          {actionLabel(current, s)}
        </Button>
      ))}
      <AssignmentStatusDialog
        assignmentId={id}
        target={target}
        title={target ? `${actionLabel(current, target)} assignment` : ''}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}

// Asks when the change took effect (today by default, earlier days allowed,
// never the future) and, for a pause or cancellation, why — the answers go
// into the assignment's status history.
export function AssignmentStatusDialog({
  assignmentId,
  target,
  title,
  onClose,
}: {
  assignmentId: string
  target: string | null
  title: string
  onClose: () => void
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const askReason = target === 'PAUSED' || target === 'CANCELLED'
  const today = localToday()

  const onSubmit = async (formData: FormData) => {
    if (!target) return
    setSaving(true)
    try {
      await updateAssignmentStatus(assignmentId, target, {
        effectiveDate: String(formData.get('effectiveDate') ?? ''),
        reason: String(formData.get('reason') ?? ''),
        note: String(formData.get('note') ?? ''),
      })
      toast.success('Assignment updated')
      onClose()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the assignment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={target !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={title}
      size="sm"
    >
      {target && (
        <form action={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="effectiveDate">{DATE_LABELS[target]}</Label>
            <Input id="effectiveDate" name="effectiveDate" type="date" required defaultValue={today} max={today} />
            <p className="text-xs text-muted-foreground mt-1">Defaults to today — pick an earlier day if it already happened.</p>
          </div>

          {askReason && (
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Select id="reason" name="reason" required defaultValue="" className="w-full">
                <option value="" disabled>
                  Select a reason
                </option>
                {ASSIGNMENT_STATUS_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {ASSIGNMENT_STATUS_REASON_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" name="note" rows={2} placeholder="e.g. client settled the invoice" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Back
            </Button>
            <Button type="submit" disabled={saving} variant={target === 'CANCELLED' ? 'destructive' : 'default'}>
              {saving ? 'Saving...' : title}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// One status action as a single button, e.g. an add-on's "Cancel request".
export function AssignmentStatusActionButton({
  assignmentId,
  target,
  label,
  title,
  className,
}: {
  assignmentId: string
  target: string
  label: string
  title: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" size="sm" variant="ghost" className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AssignmentStatusDialog
        assignmentId={assignmentId}
        target={open ? target : null}
        title={title}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
