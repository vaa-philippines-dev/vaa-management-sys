'use client'

import { useTransition } from 'react'
import { assignTicket } from '@/app/(dashboard)/tickets/actions'

export function TicketAssigneeSelect({
  ticketId,
  currentAssigneeId,
  staff,
}: {
  ticketId: string
  currentAssigneeId: string | null
  staff: { id: string; label: string }[]
}) {
  const [, startTransition] = useTransition()

  return (
    <select
      defaultValue={currentAssigneeId ?? ''}
      onChange={(e) => {
        const value = e.target.value || null
        startTransition(() => {
          assignTicket(ticketId, value)
        })
      }}
      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
    >
      <option value="">Unassigned</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  )
}
