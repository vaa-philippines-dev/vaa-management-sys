'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, UsersRound } from 'lucide-react'
import { setVATeam } from '@/app/(dashboard)/teams/actions'

export type VATeamRow = {
  departmentId: string
  departmentName: string
  teamId: string | null
  teamName: string | null
  // Active teams in this department, when the viewer may change it.
  options: { id: string; name: string }[] | null
}

// The VA's team in each department they're in — one VA in PPC and Amazon has
// a team in each. Managers change it here instead of hunting the person down
// on /teams.
export function VATeamCard({ userId, rows }: { userId: string; rows: VATeamRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [savingDept, setSavingDept] = useState<string | null>(null)

  if (rows.length === 0) return null

  const onChange = (row: VATeamRow, teamId: string) => {
    setSavingDept(row.departmentId)
    startTransition(async () => {
      try {
        await setVATeam(userId, row.departmentId, teamId || null)
        toast.success(teamId ? `Moved to ${row.options?.find((t) => t.id === teamId)?.name ?? 'team'}` : 'Removed from team')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not change team')
      } finally {
        setSavingDept(null)
      }
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
        <UsersRound className="h-3 w-3" /> Team
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.departmentId} className="flex items-center gap-3">
            {rows.length > 1 && (
              <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{row.departmentName}</span>
            )}
            {row.options ? (
              <div className="relative flex-1">
                <select
                  value={row.teamId ?? ''}
                  disabled={isPending}
                  onChange={(e) => onChange(row, e.target.value)}
                  aria-label={`Team in ${row.departmentName}`}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                >
                  <option value="">— No team —</option>
                  {row.options.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {savingDept === row.departmentId && (
                  <Loader2 className="pointer-events-none absolute right-6 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            ) : row.teamId ? (
              <Link href={`/teams/${row.teamId}`} className="text-sm font-medium hover:text-primary">
                {row.teamName}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">No team</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
