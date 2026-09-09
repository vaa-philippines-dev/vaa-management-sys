import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck } from 'lucide-react'
import { getDepartmentKpiChecks, KPI_MILESTONES, KPI_MILESTONE_LABELS } from '@/lib/kpi-checks'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { MarkKpiCheckDoneButton } from './MarkKpiCheckDoneButton'

// getDepartmentKpiChecks() is wrapped in cached() (Next's unstable_cache),
// which JSON-round-trips its return value — Date objects come back out as
// ISO strings, not Date instances. Same defensive pattern vas/page.tsx's
// own formatDate() uses for this exact reason.
function formatDate(date: Date | string) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
}

export async function DepartmentKpiChecksCard({ deptId }: { deptId: string }) {
  const checks = await cached(
    `dashboard:kpiChecks:${deptId}`,
    [CACHE_TAGS.assignments, CACHE_TAGS.dashboard],
    60,
    () => getDepartmentKpiChecks(deptId)
  )

  const totalPending = KPI_MILESTONES.reduce((sum, m) => sum + checks[m].length, 0)

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          KPI Check Update
        </CardTitle>
        {totalPending > 0 && (
          <Badge variant="outline" className="text-xs">
            {totalPending} pending
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {totalPending === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No pending KPI check-ins.</p>
        ) : (
          KPI_MILESTONES.map((milestone) => {
            const rows = checks[milestone]
            if (rows.length === 0) return null
            return (
              <div key={milestone}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  {KPI_MILESTONE_LABELS[milestone]} ({rows.length})
                </p>
                <div className="space-y-1.5">
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card text-sm">
                      <Link href={`/vas/${row.vaProfileId}`} className="font-medium hover:underline truncate">
                        {row.vaName}
                      </Link>
                      <span className={row.overdue ? 'text-warning text-xs' : 'text-muted-foreground text-xs'}>
                        {formatDate(row.dueDate)}
                        {row.overdue ? ' (overdue)' : ''}
                      </span>
                      <span className="text-muted-foreground text-xs truncate flex-1">{row.clientName}</span>
                      <MarkKpiCheckDoneButton checkId={row.id} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
