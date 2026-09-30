'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTeam, listTeamCandidates } from '@/app/(dashboard)/teams/actions'
import { MemberCombobox, type ComboboxOption } from '@/components/teams/MemberCombobox'
import { Loader2, UsersRound, X } from 'lucide-react'

export function CreateTeamForm({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  // Members to add on creation. Candidates are per department, so switching
  // department reloads them and drops anyone picked from the old one.
  const [candidates, setCandidates] = useState<ComboboxOption[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>([])

  // Guards against a slow response for a department the user has already
  // switched away from overwriting the newer one's candidates.
  const latestDepartment = useRef('')

  const changeDepartment = (id: string) => {
    setDepartmentId(id)
    setMemberIds([])
    setCandidates([])
    latestDepartment.current = id
    if (!id) return
    setLoadingCandidates(true)
    listTeamCandidates(id)
      .then((rows) => {
        if (latestDepartment.current === id) setCandidates(rows)
      })
      .catch(() => {
        if (latestDepartment.current === id) toast.error('Could not load department members')
      })
      .finally(() => {
        if (latestDepartment.current === id) setLoadingCandidates(false)
      })
  }

  const selectedMembers = memberIds
    .map((id) => candidates.find((c) => c.userId === id))
    .filter((c): c is ComboboxOption => !!c)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim() || !departmentId) {
      toast.error('Team name and department are required')
      return
    }
    const formData = new FormData()
    formData.set('name', name.trim())
    formData.set('departmentId', departmentId)
    for (const id of memberIds) formData.append('memberIds', id)

    startTransition(async () => {
      try {
        await createTeam(formData)
        // createTeam redirects on success; if we reach here it returned without redirecting.
        router.refresh()
      } catch (err) {
        // Next.js redirect() throws a special error that we must let propagate.
        if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest?: unknown }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
          throw err
        }
        toast.error(err instanceof Error ? err.message : 'Failed to create team')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Team Name *</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="e.g. Content Marketing"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="departmentId">Department *</Label>
        <select
          id="departmentId"
          name="departmentId"
          required
          value={departmentId}
          onChange={(e) => changeDepartment(e.target.value)}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50 disabled:pointer-events-none"
        >
          <option value="" disabled>Select a department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Members</Label>
        {!departmentId ? (
          <p className="text-xs text-muted-foreground">Pick a department first to add its VAs and staff.</p>
        ) : (
          <>
            <MemberCombobox
              options={candidates.filter((c) => !memberIds.includes(c.userId))}
              value=""
              disabled={isPending || loadingCandidates}
              placeholder={loadingCandidates ? 'Loading members…' : 'Search VAs and staff to add…'}
              onSelect={(userId) => {
                if (userId) setMemberIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
              }}
            />
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map((m) => (
                  <span
                    key={m.userId}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs"
                  >
                    {m.name}
                    {m.isVA && <span className="text-[10px] text-muted-foreground">VA</span>}
                    <button
                      type="button"
                      onClick={() => setMemberIds((prev) => prev.filter((id) => id !== m.userId))}
                      disabled={isPending}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${m.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Optional — you can also add members from the team page later. Leaders are picked there once the team has
              members.
            </p>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending} className="gap-2 min-w-[8.5rem]">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <UsersRound className="h-4 w-4" />
              Create Team
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
