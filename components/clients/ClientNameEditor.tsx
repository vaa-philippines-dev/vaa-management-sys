'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Pencil, Check, X } from 'lucide-react'
import { renameClient } from '@/app/(dashboard)/clients/actions'

export function ClientNameEditor({ clientId, name }: { clientId: string; name: string }) {
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
        await renameClient(clientId, trimmed)
        toast.success('Client renamed')
        setEditing(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to rename client')
      }
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setEditing(true)
        }}
        className="group flex items-center gap-1.5 text-left font-medium"
      >
        {name}
        <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        className="h-7 text-xs max-w-[180px]"
      />
      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={isPending} onClick={save}>
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={isPending} onClick={cancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
