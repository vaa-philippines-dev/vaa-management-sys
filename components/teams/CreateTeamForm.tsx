'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTeam } from '@/app/(dashboard)/teams/actions'
import { Loader2, UsersRound } from 'lucide-react'

export function CreateTeamForm({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim() || !departmentId) {
      toast.error('Team name and department are required')
      return
    }
    const formData = new FormData()
    formData.set('name', name.trim())
    formData.set('departmentId', departmentId)

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
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50 disabled:pointer-events-none"
        >
          <option value="" disabled>Select a department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
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
