'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  VA_STATUS_LABELS,
  formatDailyHours,
  type ClientSummaryRow,
  type VaSummaryRow,
} from '@/lib/va-client-summary-fields'

type View = 'vas' | 'clients'

export function VaClientSummaryBoard({
  vas,
  clients,
  departments,
}: {
  vas: VaSummaryRow[]
  clients: ClientSummaryRow[]
  departments: { id: string; name: string }[]
}) {
  const [view, setView] = useState<View>('vas')
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const showDepartment = departments.length > 1

  const q = search.trim().toLowerCase()
  const visibleVas = useMemo(
    () =>
      vas.filter((v) => {
        if (departmentId && v.departmentId !== departmentId) return false
        if (onlyUnassigned && v.clients.length > 0) return false
        if (!q) return true
        return v.name.toLowerCase().includes(q) || v.clients.some((c) => c.name.toLowerCase().includes(q))
      }),
    [vas, departmentId, onlyUnassigned, q]
  )
  const visibleClients = useMemo(
    () =>
      clients.filter((c) => {
        if (departmentId && c.departmentId !== departmentId) return false
        if (!q) return true
        return c.name.toLowerCase().includes(q) || c.vas.some((v) => v.name.toLowerCase().includes(q))
      }),
    [clients, departmentId, q]
  )

  const shown = view === 'vas' ? visibleVas.length : visibleClients.length
  const total = view === 'vas' ? vas.length : clients.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5 text-sm" role="tablist" aria-label="Summary view">
          {(
            [
              ['vas', "VAs' clients"],
              ['clients', "Clients' VAs"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn(
                'rounded-md px-3 py-1 transition-colors',
                view === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          placeholder={view === 'vas' ? 'Search VAs or clients...' : 'Search clients or VAs...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        {showDepartment && (
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-44">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
        {view === 'vas' && (
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
              className="rounded"
            />
            Only VAs with no client
          </label>
        )}
        <span className="text-xs text-muted-foreground">
          {shown} of {total}
        </span>
      </div>

      <Card className="overflow-x-auto">
        {view === 'vas' ? (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>VA</TableHead>
                {showDepartment && <TableHead>Department</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Clients</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleVas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showDepartment ? 5 : 4} className="py-10 text-center text-muted-foreground">
                    No VAs match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                visibleVas.map((v) => (
                  <TableRow key={v.key}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link href={`/vas/${v.vaProfileId}`} className="hover:text-primary">
                        {v.name}
                      </Link>
                    </TableCell>
                    {showDepartment && <TableCell className="text-muted-foreground">{v.departmentName}</TableCell>}
                    <TableCell>
                      <Badge variant={v.status === 'ACTIVE' ? 'secondary' : 'outline'}>
                        {VA_STATUS_LABELS[v.status] ?? v.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.clients.length === 0 ? (
                        <span className="text-muted-foreground">No client</span>
                      ) : (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1">
                          {v.clients.map((c) => (
                            <li key={c.id} className="whitespace-nowrap">
                              <Link href={`/clients/${c.id}`} className="hover:text-primary">
                                {c.name}
                              </Link>{' '}
                              <span className="text-muted-foreground tabular-nums">{formatDailyHours(c.hours)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {v.clients.length === 0 ? '—' : formatDailyHours(v.totalHours)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                {showDepartment && <TableHead>Department</TableHead>}
                <TableHead>VAs</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showDepartment ? 4 : 3} className="py-10 text-center text-muted-foreground">
                    No clients match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                visibleClients.map((c) => (
                  <TableRow key={c.clientId}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link href={`/clients/${c.clientId}`} className="hover:text-primary">
                        {c.name}
                      </Link>
                    </TableCell>
                    {showDepartment && <TableCell className="text-muted-foreground">{c.departmentName}</TableCell>}
                    <TableCell>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1">
                        {c.vas.map((v) => (
                          <li key={v.id} className="whitespace-nowrap">
                            <Link href={`/vas/${v.id}`} className="hover:text-primary">
                              {v.name}
                            </Link>{' '}
                            <span className="text-muted-foreground tabular-nums">{formatDailyHours(v.hours)}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatDailyHours(c.totalHours)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
