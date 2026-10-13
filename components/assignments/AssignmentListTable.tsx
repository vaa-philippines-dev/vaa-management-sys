'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssignmentStatus, AssignmentTypeBadge, type AssignmentRow } from './AssignmentCard'

export type AssignmentSortKey = 'client' | 'va' | 'status' | 'agreed' | 'logged' | 'start'
export type AssignmentSort = { key: AssignmentSortKey; dir: 'asc' | 'desc' }

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: AssignmentSortKey
  sort: AssignmentSort
  onSort: (key: AssignmentSortKey) => void
  className?: string
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={cn('px-3 py-2', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors',
          className?.includes('text-right') && 'flex-row-reverse',
          active && 'text-foreground'
        )}
      >
        {label}
        <Icon className={cn('h-3 w-3', !active && 'opacity-40')} />
      </button>
    </TableHead>
  )
}

export function AssignmentListTable({
  assignments,
  sort,
  onSort,
  showDepartment,
  showVA,
  showType,
}: {
  assignments: AssignmentRow[]
  sort: AssignmentSort
  onSort: (key: AssignmentSortKey) => void
  showDepartment: boolean
  showVA: boolean
  showType: boolean
}) {
  const router = useRouter()
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <SortHead label="Client" sortKey="client" sort={sort} onSort={onSort} />
            {showVA && <SortHead label="VA" sortKey="va" sort={sort} onSort={onSort} />}
            {showDepartment && <TableHead className="px-3 py-2 hidden md:table-cell">Department</TableHead>}
            {showType && <TableHead className="px-3 py-2">Type</TableHead>}
            <SortHead label="Status" sortKey="status" sort={sort} onSort={onSort} />
            <SortHead label="Agreed" sortKey="agreed" sort={sort} onSort={onSort} className="text-right" />
            <SortHead label="Logged" sortKey="logged" sort={sort} onSort={onSort} className="text-right" />
            <SortHead label="Start" sortKey="start" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
            <TableHead className="px-3 py-2 hidden sm:table-cell">End</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow
              key={a.id}
              className="cursor-pointer"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) return
                router.push(`/assignments/${a.id}`)
              }}
            >
              <TableCell className="px-3 py-2 max-w-[260px]">
                <Link href={`/assignments/${a.id}`} className="font-medium hover:text-primary transition-colors">
                  {a.clientName}
                </Link>
                {a.isAdditional && (
                  <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1.5">+ Additional</Badge>
                )}
                {a.clientCompany && <div className="text-[11px] text-muted-foreground truncate">{a.clientCompany}</div>}
              </TableCell>
              {showVA && (
                <TableCell className="px-3 py-2">
                  <Link href={`/vas/${a.vaProfileId}`} className="text-muted-foreground hover:text-primary transition-colors">
                    {a.vaName}
                  </Link>
                </TableCell>
              )}
              {showDepartment && (
                <TableCell className="px-3 py-2 hidden md:table-cell text-muted-foreground">{a.departmentName ?? '—'}</TableCell>
              )}
              {showType && (
                <TableCell className="px-3 py-2">
                  <AssignmentTypeBadge type={a.type} />
                </TableCell>
              )}
              <TableCell className="px-3 py-2 whitespace-nowrap">
                <AssignmentStatus status={a.status} />
              </TableCell>
              <TableCell className="px-3 py-2 text-right tabular-nums">{a.agreedHours}h</TableCell>
              <TableCell className="px-3 py-2 text-right tabular-nums text-muted-foreground">{a.loggedHours.toFixed(1)}h</TableCell>
              <TableCell className="px-3 py-2 hidden sm:table-cell text-muted-foreground whitespace-nowrap">{a.startLabel}</TableCell>
              <TableCell className="px-3 py-2 hidden sm:table-cell text-muted-foreground whitespace-nowrap">
                {a.endLabel ?? <span className="text-muted-foreground/60">Ongoing</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
