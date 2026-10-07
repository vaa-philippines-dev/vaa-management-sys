import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getViewScope, scopeDepartmentIds, scopeKey as toScopeKey, vaProfileScopeWhere } from '@/lib/scope'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HeadcountReportControls } from '@/components/reports/HeadcountReportControls'
import { Users } from 'lucide-react'
import { getHeadcountComposition } from '@/lib/headcount'
import { getStaffPeople } from '@/lib/staff'
import { HeadcountComposition } from '@/components/reports/HeadcountComposition'

// Department-level analytics — Team Leaders are scoped to their own team and
// don't get these (their team view lives in /tmf).
// Staff Masterlist statuses for someone who has left: its "Resigned /
// Removed" scorecard, plus the sheet's few INACTIVE rows.
const STAFF_OFFBOARDED = ['RESIGNED', 'REMOVED', 'INACTIVE']

const REPORTS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'OPERATIONS_MANAGER', 'STAFF', 'HR']

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

  // This report was unscoped: every role in REPORTS_VIEW_ROLES — Dept
  // Manager included — saw every department's headcount.
  // Narrow it the same way the rest of the app does, admins and HR excepted.
  const scope = await getViewScope(currentUser)
  const deptIds = scopeDepartmentIds(scope)
  const departmentScope = deptIds === null ? {} : { departmentId: { in: deptIds } }
  const scopeKey = toScopeKey(scope)

  const monthKey = format(refDate, 'yyyy-MM')

  // VAs and staff come from different sources. VA movement is the dated
  // EmploymentRecords (the VA Masterlist import reconciles one per sheet
  // row); staff are the Staff Masterlist's StaffRecords, which is where HR
  // keeps them — only ~50 staff accounts have an EmploymentRecord at all.
  const [vaHires, vaEocs, activeVAs, staff, composition] = await Promise.all([
    cached(`reports:headcount:hires:v2:${monthKey}:${scopeKey}`, [CACHE_TAGS.reports], 120, () =>
      prisma.employmentRecord.findMany({
        where: { startDate: { gte: periodStart, lte: periodEnd }, user: { userType: 'VIRTUAL_ASSISTANT' }, ...departmentScope },
        select: { departmentId: true, department: { select: { name: true } } },
      })
    ),
    cached(`reports:headcount:eocs:v2:${monthKey}:${scopeKey}`, [CACHE_TAGS.reports], 120, () =>
      prisma.employmentRecord.findMany({
        where: { endDate: { gte: periodStart, lte: periodEnd }, user: { userType: 'VIRTUAL_ASSISTANT' }, ...departmentScope },
        select: { departmentId: true, department: { select: { name: true } } },
      })
    ),
    // Active headcount is the VA Masterlist's Active scorecard rule, not
    // EmploymentRecord: `isCurrent` marks a person's latest record, not that
    // they still work here, so it counted every resigned/removed VA ever
    // imported (~2,000). Bucketed under the Masterlist's Department column
    // (primary membership), falling back to one inside the viewer's scope.
    cached(`reports:headcount:active:v2:${scopeKey}`, [CACHE_TAGS.reports, CACHE_TAGS.vas], 120, async () => {
      const vas = await prisma.vAProfile.findMany({
        where: { AND: [{ status: 'ACTIVE', user: { userType: 'VIRTUAL_ASSISTANT' } }, vaProfileScopeWhere(scope)] },
        select: {
          userId: true,
          user: {
            select: {
              memberships: {
                where: { endedAt: null },
                select: { isPrimary: true, department: { select: { id: true, name: true } } },
              },
            },
          },
        },
      })
      return vas.map((v) => {
        const mems = v.user.memberships.filter((m) => deptIds === null || deptIds.includes(m.department.id))
        const mem = mems.find((m) => m.isPrimary) ?? mems[0]
        return { userId: v.userId, departmentId: mem?.department.id ?? null, departmentName: mem?.department.name ?? 'No Department' }
      })
    }),
    // Staff mutations revalidate CACHE_TAGS.vas, hence that tag.
    cached(`reports:headcount:staff:${monthKey}:${scopeKey}`, [CACHE_TAGS.reports, CACHE_TAGS.vas], 120, async () => {
      const [people, departments] = await Promise.all([
        getStaffPeople(),
        prisma.department.findMany({ select: { id: true, name: true } }),
      ])
      const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d]))
      // A staff department is free text from the sheet; it joins a Department
      // row by name where one exists, and only those count for a
      // department-scoped viewer.
      const place = (userId: string | null, department: string | null) => {
        const dept = department ? deptByName.get(department.toLowerCase()) : undefined
        return { userId, departmentId: dept?.id ?? null, departmentName: dept?.name ?? department ?? 'No Department' }
      }
      const inScope = (p: { departmentId: string | null }) =>
        deptIds === null || (p.departmentId !== null && deptIds.includes(p.departmentId))
      const inPeriod = (d: Date | null) => !!d && d >= periodStart && d <= periodEnd
      return {
        // The Staff Masterlist's Active scorecard: latest record is ACTIVE.
        active: people
          .filter((p) => p.latest.generalStatus === 'ACTIVE')
          .map((p) => place(p.latest.userId, p.latest.department))
          .filter(inScope),
        // A hire is the person's first staff engagement; a promotion or
        // transfer adds a record but isn't a new hire.
        hires: people
          .filter((p) => inPeriod(p.staffHireDate))
          .map((p) => {
            const first = p.records.find((r) => r.startDate?.getTime() === p.staffHireDate?.getTime())
            return place(p.latest.userId, first?.department ?? p.latest.department)
          })
          .filter(inScope),
        // An EOC is someone who has left (latest record offboarded), dated by
        // its EOC date. Earlier records closed by a promotion/transfer don't.
        eocs: people
          .filter((p) => STAFF_OFFBOARDED.includes(p.latest.generalStatus ?? '') && inPeriod(p.latest.eocDate ?? p.latest.statusDate))
          .map((p) => place(p.latest.userId, p.latest.department))
          .filter(inScope),
      }
    }),
    // Point-in-time composition, deliberately not month-scoped — see the
    // note in lib/headcount.ts about why there's no historical series.
    getHeadcountComposition(deptIds),
  ])

  type DeptBucket = { departmentId: string | null; departmentName: string; vaHires: number; staffHires: number; vaEocs: number; staffEocs: number; vaActive: number; staffActive: number }
  const buckets = new Map<string, DeptBucket>()
  // Staff departments that match no Department row are keyed by name.
  const bucketKey = (id: string | null, name: string) => id ?? `name:${name}`

  const getBucket = (id: string | null, name: string) => {
    const key = bucketKey(id, name)
    if (!buckets.has(key)) {
      buckets.set(key, { departmentId: id, departmentName: name, vaHires: 0, staffHires: 0, vaEocs: 0, staffEocs: 0, vaActive: 0, staffActive: 0 })
    }
    return buckets.get(key)!
  }

  for (const h of vaHires) getBucket(h.departmentId, h.department?.name ?? 'No Department').vaHires++
  for (const t of vaEocs) getBucket(t.departmentId, t.department?.name ?? 'No Department').vaEocs++
  for (const v of activeVAs) getBucket(v.departmentId, v.departmentName).vaActive++
  for (const st of staff.hires) getBucket(st.departmentId, st.departmentName).staffHires++
  for (const st of staff.eocs) getBucket(st.departmentId, st.departmentName).staffEocs++
  for (const st of staff.active) getBucket(st.departmentId, st.departmentName).staffActive++

  // Staff who are also VAs (Team Leaders) sit on both masterlists; the
  // headline counts each person once.
  const activeVAUserIds = new Set(activeVAs.map((v) => v.userId))
  const onBothLists = staff.active.filter((st) => st.userId && activeVAUserIds.has(st.userId)).length
  const activePeople = activeVAs.length + staff.active.length - onBothLists

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
            <h2 className="text-2xl font-bold tracking-tight">Headcount</h2>
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
            <p className="text-2xl font-bold">{activePeople}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <Link href="/masterlist?status=ACTIVE#va" className="hover:text-foreground hover:underline">{totals.vaActive} VA</Link>
              {' · '}
              <Link href="/masterlist?sstatus=ACTIVE#staff" className="hover:text-foreground hover:underline">{totals.staffActive} Staff</Link>
              {onBothLists > 0 && <span title="Staff who are also VAs (Team Leaders), counted once in the total"> · {onBothLists} on both</span>}
            </p>
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

      <HeadcountComposition composition={composition} />

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
                  <TableRow key={bucketKey(r.departmentId, r.departmentName)} className="border-b">
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
