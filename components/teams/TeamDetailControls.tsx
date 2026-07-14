'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { toast } from 'sonner'
import {
  setTeamLeader,
  setTempLeader,
  addTeamMembers,
  removeTeamMembers,
  transferTeamMembers,
} from '@/app/(dashboard)/teams/actions'

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

const AVAILABILITY_TONE: Record<string, Tone> = {
  AVAILABLE: 'success',
  PARTIALLY_ASSIGNED: 'info',
  FULLY_ASSIGNED: 'warning',
  ON_LEAVE: 'neutral',
  UNAVAILABLE: 'destructive',
}

const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_ASSIGNED: 'Partially Assigned',
  FULLY_ASSIGNED: 'Fully Assigned',
  ON_LEAVE: 'On Leave',
  UNAVAILABLE: 'Unavailable',
}

export type TeamMemberRow = {
  membershipId: string
  userId: string
  name: string
  availabilityStatus: string | null
}

export type OtherTeamOption = {
  id: string
  name: string
}

export function TeamDetailControls({
  teamId,
  members,
  candidates,
  otherTeams,
  canManageMembership,
  canAssignLeaders,
  leaderId,
  tempLeader1Id,
  tempLeader2Id,
}: {
  teamId: string
  members: TeamMemberRow[]
  candidates: { userId: string; name: string }[]
  otherTeams: OtherTeamOption[]
  canManageMembership: boolean
  canAssignLeaders: boolean
  leaderId: string | null
  tempLeader1Id: string | null
  tempLeader2Id: string | null
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addUserId, setAddUserId] = useState('')
  const [transferTeamId, setTransferTeamId] = useState('')
  const [isPending, startTransition] = useTransition()

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const runAction = (fn: () => Promise<void>, successMessage: string) => {
    startTransition(async () => {
      try {
        await fn()
        toast.success(successMessage)
        setSelected(new Set())
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Action failed')
      }
    })
  }

  const handleAdd = () => {
    if (!addUserId) return
    runAction(() => addTeamMembers(teamId, [addUserId]), 'Member added')
    setAddUserId('')
  }

  const handleRemove = () => {
    if (selected.size === 0) return
    runAction(() => removeTeamMembers(teamId, Array.from(selected)), 'Member(s) removed')
  }

  const handleTransfer = () => {
    if (selected.size === 0 || !transferTeamId) return
    runAction(() => transferTeamMembers(teamId, transferTeamId, Array.from(selected)), 'Member(s) transferred')
    setTransferTeamId('')
  }

  const handleSetLeader = (userId: string) => {
    runAction(() => setTeamLeader(teamId, userId || null), 'Team Leader updated')
  }

  const handleSetTempLeader = (slot: 1 | 2, userId: string) => {
    runAction(() => setTempLeader(teamId, slot, userId || null), 'Temp Leader updated')
  }

  return (
    <div className="space-y-4">
      {canAssignLeaders && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Leadership Assignment</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <LeaderSelect
              label="Team Leader"
              value={leaderId ?? ''}
              members={members}
              disabled={isPending}
              onChange={handleSetLeader}
            />
            <LeaderSelect
              label="Temp Leader 1"
              value={tempLeader1Id ?? ''}
              members={members}
              disabled={isPending}
              onChange={(v) => handleSetTempLeader(1, v)}
            />
            <LeaderSelect
              label="Temp Leader 2"
              value={tempLeader2Id ?? ''}
              members={members}
              disabled={isPending}
              onChange={(v) => handleSetTempLeader(2, v)}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Members ({members.length})</p>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">No members yet.</p>
        ) : (
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.membershipId} className="flex items-center gap-3 px-4 py-2.5">
                {canManageMembership && (
                  <input
                    type="checkbox"
                    checked={selected.has(m.userId)}
                    onChange={() => toggle(m.userId)}
                    className="h-3.5 w-3.5 shrink-0"
                    aria-label={`Select ${m.name}`}
                  />
                )}
                <span className="text-sm font-medium flex-1">{m.name}</span>
                {(m.userId === leaderId || m.userId === tempLeader1Id || m.userId === tempLeader2Id) && (
                  <Badge variant="outline" className="text-[10px]">
                    {m.userId === leaderId ? 'Leader' : 'Temp Leader'}
                  </Badge>
                )}
                <StatusIndicator tone={AVAILABILITY_TONE[m.availabilityStatus ?? ''] ?? 'neutral'}>
                  {AVAILABILITY_LABEL[m.availabilityStatus ?? ''] ?? m.availabilityStatus ?? 'Unknown'}
                </StatusIndicator>
              </div>
            ))}
          </div>
        )}

        {canManageMembership && (
          <div className="border-t bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Add a member…</option>
                {candidates.map((c) => (
                  <option key={c.userId} value={c.userId}>{c.name}</option>
                ))}
              </select>
              <Button size="sm" disabled={!addUserId || isPending} onClick={handleAdd}>
                Add
              </Button>
            </div>

            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                <Button size="sm" variant="destructive" disabled={isPending} onClick={handleRemove}>
                  Remove
                </Button>
                <select
                  value={transferTeamId}
                  onChange={(e) => setTransferTeamId(e.target.value)}
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Transfer to…</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" disabled={!transferTeamId || isPending} onClick={handleTransfer}>
                  Transfer
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LeaderSelect({
  label,
  value,
  members,
  disabled,
  onChange,
}: {
  label: string
  value: string
  members: { userId: string; name: string }[]
  disabled: boolean
  onChange: (userId: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
      >
        <option value="">Vacant</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>{m.name}</option>
        ))}
      </select>
    </div>
  )
}
