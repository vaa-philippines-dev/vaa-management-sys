'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MessageSquareWarning, Plus } from 'lucide-react'
import { ConcernModal } from '@/components/va-concerns/ConcernModal'
import {
  CONCERN_STATUS_LABELS,
  ESCALATION_LABELS,
  formatConcernNumber,
  type ConcernRow,
  type ConcernVaOption,
} from '@/lib/va-concerns-fields'

const OPEN_STATUSES = new Set(['PENDING', 'UNDER_REVIEW', 'ESCALATED'])

export const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  UNDER_REVIEW: 'default',
  ESCALATED: 'destructive',
  RESOLVED: 'secondary',
}

export function formatConcernDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d)
}

// The latest hand-off with something written in it, for the list view.
function latestAction(c: ConcernRow): { who: string; text: string } | null {
  const steps: [string, string | null][] = [
    ['Accounting', c.accountingAction],
    ['Business Process', c.businessProcessAction],
    ['Client Experience', c.clientExperienceAction],
    ['HR', c.hrAction],
    ['Manager', c.managerAction],
    ['Team Leader', c.teamLeaderAction],
  ]
  const hit = steps.find(([, t]) => t)
  return hit ? { who: hit[0], text: hit[1]! } : null
}

export function ConcernsBoard({
  concerns,
  vaOptions,
  canRaise,
  showDepartment,
  initialConcernId,
}: {
  concerns: ConcernRow[]
  vaOptions: ConcernVaOption[]
  canRaise: boolean
  showDepartment: boolean
  initialConcernId: string | null
}) {
  const router = useRouter()
  // Opened from a notification: show that concern even if the default
  // "Open" filter would hide it.
  const [statusFilter, setStatusFilter] = useState(() => {
    const target = initialConcernId ? concerns.find((c) => c.id === initialConcernId) : null
    return target && !OPEN_STATUSES.has(target.status) ? '' : 'OPEN'
  })
  const [departmentId, setDepartmentId] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(initialConcernId)
  const [creating, setCreating] = useState(false)

  const departments = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of concerns) map.set(c.departmentId, c.departmentName)
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [concerns])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return concerns.filter((c) => {
      if (statusFilter === 'OPEN' && !OPEN_STATUSES.has(c.status)) return false
      if (statusFilter && statusFilter !== 'OPEN' && c.status !== statusFilter) return false
      if (departmentId && c.departmentId !== departmentId) return false
      if (!q) return true
      return [
        formatConcernNumber(c.number),
        c.vaName,
        c.clientName,
        c.category,
        c.concern,
        c.description,
        c.sheetConcernId,
      ].some((v) => v?.toLowerCase().includes(q))
    })
  }, [concerns, statusFilter, departmentId, search])

  const editing = editingId ? (concerns.find((c) => c.id === editingId) ?? null) : null

  const close = () => {
    setEditingId(null)
    setCreating(false)
    // Drop ?concern= so a refresh doesn't reopen it.
    if (initialConcernId) router.replace('/va-concerns')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search VA, client, concern or VC number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40" aria-label="Status">
          <option value="OPEN">Open</option>
          <option value="">All statuses</option>
          {Object.entries(CONCERN_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {showDepartment && departments.length > 1 && (
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-44" aria-label="Department">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
        <span className="text-xs text-muted-foreground">
          {visible.length} of {concerns.length}
        </span>
        {canRaise && (
          <Button size="sm" className="ml-auto" onClick={() => setCreating(true)} disabled={vaOptions.length === 0}>
            <Plus className="h-4 w-4 mr-1.5" />
            New concern
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquareWarning className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {concerns.length === 0
              ? canRaise
                ? 'No concerns yet. Use New concern to log one about a VA.'
                : 'No concerns yet.'
              : 'No concerns match these filters.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>VA</TableHead>
                {showDepartment && <TableHead>Department</TableHead>}
                <TableHead>Client</TableHead>
                <TableHead>Concern</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latest action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const action = latestAction(c)
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setEditingId(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingId(c.id)
                    }}
                    tabIndex={0}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatConcernNumber(c.number)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatConcernDate(c.concernDate)}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link
                        href={`/vas/${c.vaProfileId}`}
                        className="hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.vaName}
                      </Link>
                    </TableCell>
                    {showDepartment && <TableCell className="text-muted-foreground">{c.departmentName}</TableCell>}
                    <TableCell className="text-muted-foreground">{c.clientName ?? '—'}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="font-medium">{c.concern || c.category}</div>
                      {c.concern && <div className="text-xs text-muted-foreground">{c.category}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'outline'}>{CONCERN_STATUS_LABELS[c.status] ?? c.status}</Badge>
                      {c.status === 'ESCALATED' && c.escalatedTo && (
                        <div className="mt-0.5 text-xs text-muted-foreground">to {ESCALATION_LABELS[c.escalatedTo]}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      {action ? (
                        <>
                          <div className="text-xs text-muted-foreground">{action.who}</div>
                          <div className="line-clamp-2">{action.text}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No action yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {(creating || editing) && (
        <ConcernModal
          key={editing?.id ?? 'new'}
          concern={editing}
          vaOptions={vaOptions}
          onClose={close}
          onSaved={(message) => {
            toast.success(message)
            close()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
