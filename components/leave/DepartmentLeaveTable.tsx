import { CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_TONE, ROLE_LABELS } from '@/lib/leave-roles'

export type DepartmentLeaveRow = {
  id: string
  requesterName: string
  requesterRole: string
  departments: string[]
  leaveType: string
  startDate: string
  endDate: string
  totalDays: string
  status: string
  waitingOn: string[]
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Read-only: deciding a request happens on Leave Approvals, by whoever the
// hierarchy routed it to.
export function DepartmentLeaveTable({ rows }: { rows: DepartmentLeaveRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No staff leave to show</p>
      </div>
    )
  }

  return (
    <Card>
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Waiting on</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <p className="font-medium">{r.requesterName}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[r.requesterRole] ?? r.requesterRole}</p>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.departments.join(', ') || '—'}</TableCell>
              <TableCell>{LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}</TableCell>
              <TableCell className="text-xs">
                {fmt(r.startDate)} – {fmt(r.endDate)}
                <span className="text-muted-foreground">
                  {' '}
                  &middot; {r.totalDays} day{r.totalDays === '1' ? '' : 's'}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${LEAVE_STATUS_TONE[r.status] ?? ''}`}>
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.status === 'PENDING' && r.waitingOn.length > 0 ? r.waitingOn.join(', ') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
