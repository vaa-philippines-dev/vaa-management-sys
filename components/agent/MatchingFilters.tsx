'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const STATUS_TABS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
] as const

export function MatchingFilters({
  departments,
  kinds,
}: {
  departments: { id: string; name: string }[]
  kinds: { value: string; label: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  const currentStatus = searchParams.get('status') ?? 'PENDING'
  const currentDepartment = searchParams.get('department') ?? 'ALL'
  const currentKind = searchParams.get('kind') ?? 'ALL'

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'ALL') params.set(key, value)
    else params.delete(key)
    router.push(`/matching?${params.toString()}`)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setParam('status', tab.value)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              currentStatus === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', q)
          }}
          className="min-w-[200px] flex-1"
        >
          <Input
            placeholder="Search by client name..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full"
          />
        </form>

        <Select value={currentDepartment} onChange={(e) => setParam('department', e.target.value)} className="w-auto">
          <option value="ALL">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        <Select value={currentKind} onChange={(e) => setParam('kind', e.target.value)} className="w-auto">
          <option value="ALL">All types</option>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
