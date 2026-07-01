import { prisma } from '@/lib/prisma'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { MonthlyReportControls } from '@/components/reports/MonthlyReportControls'
import { BarChart3 } from 'lucide-react'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const refDate = month ? new Date(`${month}-01`) : new Date()
  const periodStart = startOfMonth(refDate)
  const periodEnd = endOfMonth(refDate)

  const assignments = await cached('reports:assignments', [CACHE_TAGS.reports], 30, () =>
    prisma.assignment.findMany({
      where: {
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: {
        client: true,
        vaProfile: { include: { user: true } },
        workLogs: {
          where: {
            workDate: { gte: periodStart, lte: periodEnd },
          },
        },
      },
      orderBy: [{ client: { name: 'asc' } }, { vaProfile: { user: { firstName: 'asc' } } }],
    })
  )

  const rows = assignments.map((a) => {
    const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
    const agreed = Number(a.agreedHours)
    const monthlyTarget = a.monthlyHours ? Number(a.monthlyHours) : agreed
    const variance = logged - monthlyTarget
    const utilization = monthlyTarget > 0 ? (logged / monthlyTarget) * 100 : 0
    return { a, logged, agreed, monthlyTarget, variance, utilization }
  })

  const totalLogged = rows.reduce((s, r) => s + r.logged, 0)
  const totalAgreed = rows.reduce((s, r) => s + r.monthlyTarget, 0)
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
        <MonthlyReportControls currentMonth={format(refDate, 'yyyy-MM')} />
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Agreed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAgreed.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Over Target</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{overTarget}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Under Target</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{underTarget}</p>
          </CardContent>
        </Card>
      </div>

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
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Agreed</TableHead>
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
                      {a.vaProfile.user.firstName || a.vaProfile.user.email}
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
                            ? 'text-sm font-medium text-orange-600'
                            : variance < 0
                              ? 'text-sm font-medium text-blue-600'
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
                                ? 'h-full bg-orange-500'
                                : utilization >= 80
                                  ? 'h-full bg-green-500'
                                  : utilization > 0
                                    ? 'h-full bg-blue-500'
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
