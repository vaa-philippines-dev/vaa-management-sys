'use client'

import { cn } from '@/lib/utils'

type Member = { id: string; firstName: string; lastName: string; avatarUrl: string | null }

export function MentionAutocomplete({
  members,
  activeIndex,
  onPick,
}: {
  members: Member[]
  activeIndex: number
  onPick: (member: Member) => void
}) {
  if (members.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-1.5 w-64 overflow-hidden rounded-lg border bg-popover shadow-lg animate-in fade-in-0 slide-in-from-bottom-1 duration-150">
      {members.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(m)
          }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
            i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
          )}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
            {m.firstName[0]}
            {m.lastName[0]}
          </div>
          <span className="font-medium">
            {m.firstName} {m.lastName}
          </span>
        </button>
      ))}
    </div>
  )
}
