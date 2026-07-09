'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteTicket } from '@/app/(dashboard)/tickets/actions'

export function DeleteTicketButton({ id, ticketNumber }: { id: string; ticketNumber: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="text-destructive hover:bg-destructive/10"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`Delete ticket ${ticketNumber}? This cannot be undone.`)) return
        startTransition(() => {
          deleteTicket(id)
        })
      }}
    >
      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  )
}
