import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HeadcountReportControls } from '@/components/reports/HeadcountReportControls'
import { Users } from 'lucide-react'

const REPORTS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF']

export default async function HeadcountReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !REPORTS_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const { month } = await searchParams
  const refDate = month ? new Date(`${month}-01`) : new Date()
  const periodStart = startOfMonth(refDate)
  const periodEnd = endOfMonth(refDate)

  const [hires, terminations, activeCount] = await Promise.all([
    cached(`reports:headcount:hires:${format(refDate, 'yyyy-MM')}`, [CACHE_TAGS.reports], 120, () =>
      prisma.employmentRecord.findMany({
        where: { startDate: { gte: periodStart, lte: periodEnd } },
        include: {
          user: { select: { firstName: true, lastName: true, userType: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { startDate: 'asc' },
      })
    ),
    cached(`reports:headcount:eocs:${format(refDate, 'yyyy-MM')}`, [CACHE_TAGS.reports], 120, () =>
      prisma.employmentRecord.findMany({
        where: { endDate: { gte: periodStart, lte: periodEnd } },
        include: {
          user: { select: { firstName: true, lastName: true, userType: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { endDate: 'asc' },
      })
    ),
    cached('reports:headcount:active', [CACHE_TAGS.reports], 120, () =>
      prisma.employmentRecord.findMany({
        where: { isCurrent: true },
        include: {
          user: { select: { userType: true } },
          department: { select: { id: true, name: true } },
        },
      })
    ),
  ])

  type DeptBucket = { departmentId: string | null; departmentName: string; vaHires: number; staffHires: number; vaEocs: number; staffEocs: number; vaActive: number; staffActive: number }
  const buckets = new Map<string, DeptBucket>()
  const bucketKey = (id: string | null) => id ?? '__none__'

  const getBucket = (id: string | null, name: string) => {
    const key = bucketKey(id)
    if (!buckets.has(key)) {
      buckets.set(key, { departmentId: id, departmentName: name, vaHires: 0, staffHires: 0, vaEocs: 0, staffEocs: 0, vaActive: 0, staffActive: 0 })
    }
    return buckets.get(key)!
  }

  for (const h of hires) {
    const b = getBucket(h.departmentId, h.department?.name ?? 'No Department')
    if (h.user.userType === 'VIRTUAL_ASSISTANT') b.vaHires++
    else b.staffHires++
  }
  for (const t of terminations) {
    const b = getBucket(t.departmentId, t.department?.name ?? 'No Department')
    if (t.user.userType === 'VIRTUAL_ASSISTANT') b.vaEocs++
    else b.staffEocs++
  }
  for (const a of activeCount) {
    const b = getBucket(a.departmentId, a.department?.name ?? 'No Department')
    if (a.user.userType === 'VIRTUAL_ASSISTANT') b.vaActive++
    else b.staffActive++
  }

  const rows = Array.from(buckets.values()).sort((a, b) => a.departmentName.localeCompare(b.departmentName))

  const totals = rows.reduce(
    (acc, r) => ({
      vaHires: acc.vaHires + r.vaHires,
      staffHires: acc.staffHires + r.staffHires,
      vaEocs: acc.vaEocs + r.vaEocs,
      staffEocs: acc.staffEocs + r.staffEocs,
      vaActive: acc.vaActive + r.vaActive,
      staffActive: acc.staffActive + r.staffActive,
    }),
    { vaHires: 0, staffHires: 0, vaEocs: 0, staffEocs: 0, vaActive: 0, staffActive: 0 }
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Headcount Report</h2>
            <Link href="/reports" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              ← Hours Report
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{format(periodStart, 'MMMM yyyy')}</p>
        </div>
        <HeadcountReportControls currentMonth={format(refDate, 'yyyy-MM')} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Headcount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.vaActive + totals.staffActive}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.vaActive} VA · {totals.staffActive} Staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{totals.vaHires + totals.staffHires}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.vaHires} VA · {totals.staffHires} Staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EOC / Terminated This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{totals.vaEocs + totals.staffEocs}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.vaEocs} VA · {totals.staffEocs} Staff</p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No employment activity for this period.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By Department</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Department</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Active</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">New Hires</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">EOC / Terminated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={bucketKey(r.departmentId)} className="border-b">
                    <TableCell className="py-3 font-medium">{r.departmentName}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.vaActive + r.staffActive}
                      <span className="text-muted-foreground text-xs"> ({r.vaActive} VA, {r.staffActive} Staff)</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {(r.vaHires + r.staffHires) > 0 ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          +{r.vaHires + r.staffHires}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(r.vaEocs + r.staffEocs) > 0 ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          -{r.vaEocs + r.staffEocs}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
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
