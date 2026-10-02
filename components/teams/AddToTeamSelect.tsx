'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { addTeamMembers } from '@/app/(dashboard)/teams/actions'

// Puts one person on a team straight from a list (Team Assignment's
// Unassigned VAs) instead of sending the manager off to /teams to find them.
export function AddToTeamSelect({
  userId,
  teams,
  className,
}: {
  userId: string
  teams: { id: string; name: string }[]
  className?: string
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  if (teams.length === 0) return null

  const onChange = (teamId: string) => {
    if (!teamId) return
    setValue(teamId)
    startTransition(async () => {
      try {
        await addTeamMembers(teamId, [userId])
        toast.success(`Added to ${teams.find((t) => t.id === teamId)?.name ?? 'team'}`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add to team')
        setValue('')
      }
    })
  }

  return (
    <div className={`relative shrink-0 ${className ?? ''}`}>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Add to team"
        className="h-7 w-36 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
      >
        <option value="">Add to team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {isPending && (
        <Loader2 className="pointer-events-none absolute right-6 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
