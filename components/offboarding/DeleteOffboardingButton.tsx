'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteTermination } from '@/app/(dashboard)/vas/actions'

export function DeleteOffboardingButton({ id, vaName }: { id: string; vaName: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="text-destructive hover:bg-destructive/10"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`Delete this offboarding case for ${vaName}? This cannot be undone.`)) return
        startTransition(() => {
          deleteTermination(id)
        })
      }}
    >
      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  )
}
