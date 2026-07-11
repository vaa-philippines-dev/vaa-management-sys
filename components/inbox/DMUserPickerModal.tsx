'use client'

import { useEffect, useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { getOrgUsersForDMPicker, findOrCreateDirectMessageChannel } from '@/app/(dashboard)/inbox/actions'

export type PickerUser = { id: string; firstName: string; lastName: string; avatarUrl: string | null; email: string }

export function DMUserPickerModal({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStarted: (channelId: string, otherUser: PickerUser) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickerUser[]>([])
  const [isPending, startTransition] = useTransition()
  const [startingId, setStartingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(() => {
      getOrgUsersForDMPicker(query).then(setResults)
    }, 200)
    return () => clearTimeout(timeout)
  }, [open, query])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setQuery('')
      setResults([])
    }
  }

  const handlePick = (user: PickerUser) => {
    setStartingId(user.id)
    startTransition(async () => {
      const { channelId } = await findOrCreateDirectMessageChannel(user.id)
      setStartingId(null)
      handleOpenChange(false)
      onStarted(channelId, user)
    })
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} title="New message" size="sm">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email..."
        className="mb-2 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
        {results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No users found.</p>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={isPending}
              onClick={() => handlePick(u)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold">
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt={`${u.firstName} ${u.lastName}`} className="h-full w-full object-cover" />
                ) : (
                  <>
                    {u.firstName[0]}
                    {u.lastName[0]}
                  </>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {u.firstName} {u.lastName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
              </div>
              {startingId === u.id && <span className="shrink-0 text-[10px] text-muted-foreground">Starting...</span>}
            </button>
          ))
        )}
      </div>
    </Modal>
  )
}
