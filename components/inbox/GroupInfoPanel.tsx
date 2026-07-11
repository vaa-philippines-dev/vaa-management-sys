'use client'

import { useEffect, useState } from 'react'
import { Pin, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGroupInfo } from '@/app/(dashboard)/inbox/actions'

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  EXECUTIVE: 'Executive',
  DEPT_MANAGER: 'Dept Manager',
  TEAM_LEADER: 'Team Leader',
  OPERATIONS_MANAGER: 'Operations Manager',
  STAFF: 'Staff',
  VA: 'Virtual Assistant',
}

type GroupInfo = {
  departmentName: string | null
  description: string | null
  pinnedCount: number
  members: {
    isPrimary: boolean
    user: { id: string; firstName: string; lastName: string; avatarUrl: string | null; systemRole: string }
    position: { title: string } | null
  }[]
}

export function GroupInfoPanel({
  channelId,
  onClose,
  onOpenPinned,
}: {
  channelId: string
  onClose: () => void
  onOpenPinned: () => void
}) {
  const [info, setInfo] = useState<GroupInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    getGroupInfo(channelId).then((data) => {
      if (!cancelled) setInfo(data)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- component is remounted (keyed) by parent on channel change
  }, [])

  return (
    <div
      className={cn(
        'flex h-full w-72 shrink-0 flex-col border-l bg-card',
        'animate-in slide-in-from-right-8 fade-in-0 duration-200'
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">Group info</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close group info"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!info ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Loading...</p>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">{info.departmentName}</p>
            {info.description && <p className="mt-1 text-[12px] text-muted-foreground">{info.description}</p>}
          </div>

          <button
            type="button"
            onClick={onOpenPinned}
            className="flex items-center gap-2 border-b px-4 py-2.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Pin className="h-3.5 w-3.5" />
            <span className="flex-1">Pinned messages</span>
            {info.pinnedCount > 0 && <span className="text-[11px]">{info.pinnedCount}</span>}
          </button>

          <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground">
            {info.members.length} member{info.members.length === 1 ? '' : 's'}
          </div>
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {info.members.map((m) => (
              <div key={m.user.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold">
                  {m.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.user.avatarUrl}
                      alt={`${m.user.firstName} ${m.user.lastName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      {m.user.firstName[0]}
                      {m.user.lastName[0]}
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {m.user.firstName} {m.user.lastName}
                    {m.isPrimary && <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold text-primary">Primary</span>}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {ROLE_LABELS[m.user.systemRole] ?? m.user.systemRole}
                    {m.position?.title ? ` · ${m.position.title}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
