import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { getViewScope, assignmentScopeWhere, scopeKey as toScopeKey } from '@/lib/scope'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MonthlyReportControls } from '@/components/reports/MonthlyReportControls'
import { buttonVariants } from '@/components/ui/button'
import { BarChart3, PieChart } from 'lucide-react'

// Department-level analytics — Team Leaders are scoped to their own team and
// don't get these (their team view lives in /tmf).
const REPORTS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'OPERATIONS_MANAGER', 'STAFF', 'HR']

const DAY_MS = 24 * 60 * 60 * 1000
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

function currentManilaMonth(): [number, number] {
  const now = new Date(Date.now() + MANILA_OFFSET_MS)
  return [now.getUTCFullYear(), now.getUTCMonth()]
}

// Mon–Fri days in [from, to), both UTC-midnight dates.
function countWorkdays(from: Date, to: Date) {
  let n = 0
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const day = new Date(t).getUTCDay()
    if (day !== 0 && day !== 6) n++
  }
  return n
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !REPORTS_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  // Assignment dates and work dates are stored as UTC midnight, so the month
  // window is UTC too; "this month" is the current month in Manila.
  const { month } = await searchParams
  const [year, monthIndex] = month && /^\d{4}-\d{2}$/.test(month)
    ? [Number(month.slice(0, 4)), Number(month.slice(5)) - 1]
    : currentManilaMonth()
  const periodStart = new Date(Date.UTC(year, monthIndex, 1))
  const periodEnd = new Date(Date.UTC(year, monthIndex + 1, 1)) // exclusive
  const monthKey = periodStart.toISOString().slice(0, 7)

  // Department managers get their own departments' hours, not the company's.
  const scope = await getViewScope(currentUser)
  const scopeKey = toScopeKey(scope)

  // The where clause and the nested workLogs filter both depend on the month,
  // so it must be in the key. Same for the department scope — one manager's
  // rows must not be served to another.
  const assignments = await cached(`reports:assignments:v2:${monthKey}:${scopeKey}`, [CACHE_TAGS.reports, CACHE_TAGS.assignments, CACHE_TAGS.worklogs], 120, () =>
    prisma.assignment.findMany({
      where: {
        ...assignmentScopeWhere(scope),
        OR: [
          // Engagements that ran during the month. A COMPLETED one with no end
          // date can't be placed in time, so it only shows if it logged hours.
          {
            startDate: { lt: periodEnd },
            OR: [
              { status: 'ACTIVE', OR: [{ endDate: null }, { endDate: { gte: periodStart } }] },
              { status: 'COMPLETED', endDate: { gte: periodStart } },
            ],
          },
          // Anything with hours logged this month, whatever its status now.
          { workLogs: { some: { workDate: { gte: periodStart, lt: periodEnd } } } },
        ],
      },
      include: {
        client: true,
        vaProfile: { include: { user: true } },
        workLogs: {
          where: {
            workDate: { gte: periodStart, lt: periodEnd },
          },
        },
      },
      orderBy: [{ client: { name: 'asc' } }, { vaProfile: { user: { firstName: 'asc' } } }],
    })
  )

  const monthWorkdays = countWorkdays(periodStart, periodEnd)
  const rows = assignments.map((a) => {
    const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
    // Only the weekdays the engagement actually covered this month count
    // toward the target, so a mid-month start or end isn't charged a full month.
    const from = a.startDate > periodStart ? a.startDate : periodStart
    const endExclusive = a.endDate ? new Date(a.endDate.getTime() + DAY_MS) : null
    const to = endExclusive && endExclusive < periodEnd ? endExclusive : periodEnd
    const workdays = countWorkdays(from, to)
    // agreedHours is hours per day (8 = full time, as in the DMF's NO OF
    // HOURS); monthlyHours, when set, is a full month's target.
    const monthlyTarget =
      a.type === 'PROJECT' ? Number(a.agreedHours)
      : a.monthlyHours ? (Number(a.monthlyHours) * workdays) / monthWorkdays
      : Number(a.agreedHours) * workdays
    const variance = logged - monthlyTarget
    const utilization = monthlyTarget > 0 ? (logged / monthlyTarget) * 100 : 0
    return { a, logged, monthlyTarget, variance, utilization }
  })

  const totalLogged = rows.reduce((s, r) => s + r.logged, 0)
  const totalTarget = rows.reduce((s, r) => s + r.monthlyTarget, 0)
  const overTarget = rows.filter((r) => r.variance > 0).length
  const underTarget = rows.filter((r) => r.variance < 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Monthly Hours Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {format(periodStart, 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports/headcount" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <PieChart data-icon="inline-start" />
            View Headcount
          </Link>
          <MonthlyReportControls currentMonth={monthKey} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Logged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLogged.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Target</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalTarget.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Over Target</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">{overTarget}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Under Target</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-info">{underTarget}</p>
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 && totalLogged === 0 && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            No work logs were recorded for {format(periodStart, 'MMMM yyyy')}, so every assignment shows 0h logged and
            0% utilization. These figures fill in as hours are logged under Work Logs.
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No active assignments for this period.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hours by Assignment</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Client</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">VA</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right" title="Hours per day × weekdays the assignment ran this month (or Monthly Hours, when set)">Target</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Logged</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Variance</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ a, logged, monthlyTarget, variance, utilization }) => (
                  <TableRow key={a.id} className="border-b">
                    <TableCell className="py-3">
                      <a
                        href={`/clients/${a.client.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.client.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[a.vaProfile.user.firstName, a.vaProfile.user.lastName].filter(Boolean).join(' ') || a.vaProfile.user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.type === 'REGULAR' ? 'default' : 'outline'} className="text-xs">
                        {a.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {monthlyTarget.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {logged.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          variance > 0
                            ? 'text-sm font-medium text-warning'
                            : variance < 0
                              ? 'text-sm font-medium text-info'
                              : 'text-sm text-muted-foreground'
                        }
                      >
                        {variance > 0 ? '+' : ''}{variance.toFixed(1)}h
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={
                              utilization > 100
                                ? 'h-full bg-warning'
                                : utilization >= 80
                                  ? 'h-full bg-success'
                                  : utilization > 0
                                    ? 'h-full bg-info'
                                    : 'h-full bg-muted'
                            }
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {utilization.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
