import Link from 'next/link'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { AssignmentRow } from './AssignmentCard'

export function AssignmentListTable({ assignments }: { assignments: AssignmentRow[] }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="px-3 py-2">Client</TableHead>
            <TableHead className="px-3 py-2">VA</TableHead>
            <TableHead className="px-3 py-2">Status</TableHead>
            <TableHead className="px-3 py-2 text-right">Agreed</TableHead>
            <TableHead className="px-3 py-2 text-right">Logged</TableHead>
            <TableHead className="px-3 py-2 hidden sm:table-cell">Start</TableHead>
            <TableHead className="px-3 py-2 hidden sm:table-cell">End</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow key={a.id} className="cursor-pointer">
              <TableCell className="px-3 py-2 font-medium">
                <Link href={`/assignments/${a.id}`} className="hover:text-primary transition-colors">
                  {a.clientName}
                </Link>
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground">{a.vaName}</TableCell>
              <TableCell className="px-3 py-2">
                <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">
                  {a.status}
                </Badge>
              </TableCell>
              <TableCell className="px-3 py-2 text-right text-muted-foreground">{a.agreedHours}h</TableCell>
              <TableCell className="px-3 py-2 text-right text-muted-foreground">{a.loggedHours.toFixed(1)}h</TableCell>
              <TableCell className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{a.startLabel}</TableCell>
              <TableCell className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{a.endLabel ?? 'Ongoing'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
