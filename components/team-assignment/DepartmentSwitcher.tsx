'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'

// Switches /team-assignment to another department as soon as one is picked.
// A team/state filter belongs to the department being left, so it's dropped.
export function DepartmentSwitcher({
  departments,
  value,
}: {
  departments: { id: string; name: string }[]
  value: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <label className="relative inline-flex items-center">
      <Building2 className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value ?? ''}
        disabled={isPending}
        onChange={(e) => {
          const dept = e.target.value
          startTransition(() => router.push(`/team-assignment?dept=${encodeURIComponent(dept)}`))
        }}
        aria-label="Department"
        className="h-9 rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {isPending && <Loader2 className="pointer-events-none absolute right-7 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </label>
  )
}
