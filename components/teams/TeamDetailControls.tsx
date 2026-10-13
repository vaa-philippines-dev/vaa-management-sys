'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MemberCombobox } from '@/components/teams/MemberCombobox'
import { TeamRoster, type TeamMemberRow } from '@/components/teams/TeamRoster'
import { toast } from 'sonner'
import { Loader2, Crown, ArrowRightLeft, UserMinus, UserPlus } from 'lucide-react'
import {
  setTeamLeader,
  setTempLeader,
  addTeamMembers,
  removeTeamMembers,
  transferTeamMembers,
} from '@/app/(dashboard)/teams/actions'

export type { TeamMemberRow }

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
  linkProfiles,
}: {
  teamId: string
  members: TeamMemberRow[]
  candidates: { userId: string; name: string; isVA?: boolean }[]
  otherTeams: OtherTeamOption[]
  canManageMembership: boolean
  canAssignLeaders: boolean
  leaderId: string | null
  tempLeader1Id: string | null
  tempLeader2Id: string | null
  linkProfiles: boolean
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

  // Toggles the members currently shown (the roster may be filtered).
  const toggleAll = (userIds: string[]) => {
    setSelected((prev) => {
      const allOn = userIds.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of userIds) {
        if (allOn) next.delete(id)
        else next.add(id)
      }
      return next
    })
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

      <TeamRoster
        members={members}
        leaderId={leaderId}
        tempLeader1Id={tempLeader1Id}
        tempLeader2Id={tempLeader2Id}
        linkProfiles={linkProfiles}
        selected={canManageMembership ? selected : undefined}
        onToggle={canManageMembership ? toggle : undefined}
        onToggleAll={canManageMembership ? toggleAll : undefined}
        footer={
          canManageMembership ? (
            <div className="border-t bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <UserPlus className="h-3.5 w-3.5" />
                  Add member
                </span>
                <MemberCombobox
                  options={candidates}
                  value={addUserId}
                  disabled={isPending}
                  onSelect={(userId) => {
                    setAddUserId(userId)
                    if (userId) handleAdd(userId)
                  }}
                />
                {pendingAction === 'add' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>

              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                  <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Clear
                  </button>
                  <Button size="sm" variant="destructive" disabled={isPending} onClick={handleRemove} className="gap-1.5">
                    {pendingAction === 'remove' ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
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
          ) : undefined
        }
      />
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
