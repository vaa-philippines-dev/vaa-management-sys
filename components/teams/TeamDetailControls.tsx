'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { MemberCombobox } from '@/components/teams/MemberCombobox'
import { toast } from 'sonner'
import { Loader2, Crown, ArrowRightLeft, UserMinus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
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
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const allSelected = members.length > 0 && selected.size === members.length

  const toggleAll = () => {
    setSelected((prev) => (prev.size === members.length ? new Set() : new Set(members.map((m) => m.userId))))
  }

  const runAction = (key: string, fn: () => Promise<void>, successMessage: string) => {
    setPendingAction(key)
    startTransition(async () => {
      try {
        await fn()
        toast.success(successMessage)
        setSelected(new Set())
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Action failed')
      } finally {
        setPendingAction(null)
      }
    })
  }

  const handleAdd = (userId: string) => {
    if (!userId) return
    runAction('add', () => addTeamMembers(teamId, [userId]), 'Member added')
    setAddUserId('')
  }

  const handleRemove = () => {
    if (selected.size === 0) return
    runAction('remove', () => removeTeamMembers(teamId, Array.from(selected)), 'Member(s) removed')
  }

  const handleTransfer = () => {
    if (selected.size === 0 || !transferTeamId) return
    runAction('transfer', () => transferTeamMembers(teamId, transferTeamId, Array.from(selected)), 'Member(s) transferred')
    setTransferTeamId('')
  }

  const handleSetLeader = (userId: string) => {
    runAction('leader', () => setTeamLeader(teamId, userId || null), 'Team Leader updated')
  }

  const handleSetTempLeader = (slot: 1 | 2, userId: string) => {
    runAction(`temp${slot}`, () => setTempLeader(teamId, slot, userId || null), 'Temp Leader updated')
  }

  return (
    <div className="space-y-4">
      {canAssignLeaders && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Leadership Assignment</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <LeaderSelect
              label="Team Leader"
              value={leaderId ?? ''}
              members={members}
              disabled={isPending}
              loading={pendingAction === 'leader'}
              onChange={handleSetLeader}
            />
            <LeaderSelect
              label="Temp Leader 1"
              value={tempLeader1Id ?? ''}
              members={members}
              disabled={isPending}
              loading={pendingAction === 'temp1'}
              onChange={(v) => handleSetTempLeader(1, v)}
            />
            <LeaderSelect
              label="Temp Leader 2"
              value={tempLeader2Id ?? ''}
              members={members}
              disabled={isPending}
              loading={pendingAction === 'temp2'}
              onChange={(v) => handleSetTempLeader(2, v)}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Members ({members.length})</p>
          </div>
          {canManageMembership && members.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No members yet. Add one below to get started.</p>
          </div>
        ) : (
          <div className="divide-y">
            {members.map((m) => (
              <div
                key={m.membershipId}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 transition-colors',
                  selected.has(m.userId) && 'bg-accent/40'
                )}
              >
                {canManageMembership && (
                  <input
                    type="checkbox"
                    checked={selected.has(m.userId)}
                    onChange={() => toggle(m.userId)}
                    className="h-3.5 w-3.5 shrink-0 accent-primary"
                    aria-label={`Select ${m.name}`}
                  />
                )}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {initials(m.name)}
                </span>
                <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                {(m.userId === leaderId || m.userId === tempLeader1Id || m.userId === tempLeader2Id) && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Crown className="h-2.5 w-2.5" />
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
              <MemberCombobox
                options={candidates}
                value={addUserId}
                disabled={isPending}
                onSelect={(userId) => {
                  setAddUserId(userId)
                  if (userId) handleAdd(userId)
                }}
              />
              {pendingAction === 'add' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                <Button size="sm" variant="destructive" disabled={isPending} onClick={handleRemove} className="gap-1.5">
                  {pendingAction === 'remove' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <UserMinus className="h-3 w-3" />
                  )}
                  Remove
                </Button>
                <select
                  value={transferTeamId}
                  onChange={(e) => setTransferTeamId(e.target.value)}
                  disabled={isPending}
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                >
                  <option value="">Transfer to…</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!transferTeamId || isPending}
                  onClick={handleTransfer}
                  className="gap-1.5"
                >
                  {pendingAction === 'transfer' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-3 w-3" />
                  )}
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
  loading,
  onChange,
}: {
  label: string
  value: string
  members: { userId: string; name: string }[]
  disabled: boolean
  loading?: boolean
  onChange: (userId: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <option value="">Vacant</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.name}</option>
          ))}
        </select>
        {loading && (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  )
}
