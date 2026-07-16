'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/inbox/ConfirmDialog'
import { Loader2, Trash2 } from 'lucide-react'
import { deleteTeam } from '@/app/(dashboard)/teams/actions'

export function DeleteTeamButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    setConfirmOpen(false)
    startTransition(async () => {
      try {
        await deleteTeam(teamId)
        toast.success(`"${teamName}" deleted`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete team')
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={isPending}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setConfirmOpen(true)
        }}
        aria-label={`Delete ${teamName}`}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${teamName}"?`}
        description="This permanently removes the team and all of its membership history. This cannot be undone."
        confirmLabel="Delete Team"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
