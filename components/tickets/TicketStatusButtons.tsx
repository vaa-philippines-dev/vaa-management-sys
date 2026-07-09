'use client'

import { Button } from '@/components/ui/button'
import { updateTicketStatus } from '@/app/(dashboard)/tickets/actions'

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_CLIENT', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_ON_CLIENT', 'RESOLVED'],
  WAITING_ON_CLIENT: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
}

export function TicketStatusButtons({ id, current }: { id: string; current: string }) {
  const options = TRANSITIONS[current] ?? []
  if (options.length === 0) return null

  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <form key={s} action={updateTicketStatus.bind(null, id, s)}>
          <Button type="submit" size="sm" variant="outline">
            {s.replace(/_/g, ' ')}
          </Button>
        </form>
      ))}
    </div>
  )
}
