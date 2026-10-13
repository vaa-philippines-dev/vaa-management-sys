'use client'

import { Button } from '@/components/ui/button'
import { updateAssignmentStatus } from '@/app/(dashboard)/assignments/actions'

// Button label per target status — the action, not the raw enum.
const ACTION_LABELS: Record<string, string> = {
  ACTIVE: 'Resume',
  PAUSED: 'Pause',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancel',
}

export function AssignmentStatusButtons({
  id,
  current,
}: {
  id: string
  current: string
}) {
  const transitions: Record<string, string[]> = {
    ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
    PAUSED: ['ACTIVE', 'CANCELLED'],
    ON_HOLD: ['ACTIVE', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: ['ACTIVE'],
  }

  const options = transitions[current] ?? []

  if (options.length === 0) return null

  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <form key={s} action={updateAssignmentStatus.bind(null, id, s)}>
          <Button type="submit" size="sm" variant="outline">
            {current === 'CANCELLED' && s === 'ACTIVE' ? 'Reactivate' : ACTION_LABELS[s]}
          </Button>
        </form>
      ))}
    </div>
  )
}
