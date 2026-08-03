'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { decideSuggestion } from '@/app/(dashboard)/matching/actions'

export function DecisionControls({ suggestionId }: { suggestionId: string }) {
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [decided, setDecided] = useState<'APPROVED' | 'REJECTED' | null>(null)

  const decide = (status: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
      try {
        await decideSuggestion(suggestionId, status, note)
        setDecided(status)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not record that decision.')
      }
    })
  }

  if (decided) {
    return (
      <p className="text-[11px] font-medium text-muted-foreground">
        Marked {decided === 'APPROVED' ? 'approved' : 'rejected'} just now.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note..."
        disabled={pending}
        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-[11px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => decide('REJECTED')}>
        Reject
      </Button>
      <Button size="sm" disabled={pending} onClick={() => decide('APPROVED')}>
        Approve
      </Button>
    </div>
  )
}
