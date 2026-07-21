'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Pencil, Check, X } from 'lucide-react'
import { renameTeam } from '@/app/(dashboard)/teams/actions'

export function TeamNameEditor({ teamId, name }: { teamId: string; name: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [isPending, startTransition] = useTransition()

  const cancel = () => {
    setValue(name)
    setEditing(false)
  }

  const save = () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) {
      cancel()
      return
    }
    startTransition(async () => {
      try {
        await renameTeam(teamId, trimmed)
        toast.success('Team renamed')
        setEditing(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to rename team')
      }
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1.5 text-2xl font-bold tracking-tight"
      >
        {name}
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        className="h-9 text-lg font-semibold max-w-xs"
      />
      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={isPending} onClick={save}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={isPending} onClick={cancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
