import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import { getFeaturedFavorite } from '@/lib/favorites'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import {
  Building2,
  Users,
  Briefcase,
  Clock,
  BarChart3,
  Plus,
  ArrowRight,
  AlertCircle,
  UsersRound,
  CalendarHeart,
} from 'lucide-react'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { CircularProgress } from '@/components/ui/circular-progress'

// VAProfile has no discrete full-time/part-time field — inferred from
// totalCapacityHours (schema default 40h/week); null defaults to full-time
// to match that same schema default.
const FULL_TIME_CAPACITY_THRESHOLD_HOURS = 35
// How far ahead the department dashboard's "Upcoming Anniversaries" widget
// looks — kept short since it's a glance widget, not the full Celebrants page.
const UPCOMING_EVENTS_WINDOW_DAYS = 30

const AVAILABILITY_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_ASSIGNED: 'Partial',
  FULLY_ASSIGNED: 'Full',
  ON_LEAVE: 'On Leave',
  UNAVAILABLE: 'Unavailable',
}

// Rolls a recurring (month, day) anniversary into its next occurrence from
// `from` — this year if not yet passed, otherwise next year.
function nextOccurrence(month: number, day: number, from: Date): Date {
  const year = from.getFullYear()
  let candidate = new Date(year, month, day)
  if (candidate < from) candidate = new Date(year + 1, month, day)
  return candidate
}

function toValidDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value as string)
  return isNaN(d.getTime()) ? null : d
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>
}) {
  const params = await searchParams
  const deptId = params.dept

  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!user) redirect('/login')

  if (user.userType !== 'VIRTUAL_ASSISTANT' && !deptId) {
    const featured = await getFeaturedFavorite(user.id)
    if (featured && featured.href !== '/dashboard') {
      redirect(featured.href)
    }
  }

  if (['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole) && !deptId) {
    redirect('/departments')
  }

  if (user.userType === 'VIRTUAL_ASSISTANT') {
    const vaId = user.vaProfile?.id
    if (!vaId) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Your VA profile is being set up. Please contact an administrator.</p>
        </div>
      )
    }
    return (
      <Suspense fallback={<VADashSkeleton />}>
        <VADashboard userId={user.id} vaProfileId={vaId} />
      </Suspense>
    )
  }

  const department = deptId
    ? await cached(`dashboard:department:${deptId}`, [CACHE_TAGS.departments, CACHE_TAGS.dashboard], 600, () =>
        prisma.department.findUnique({ where: { id: deptId } })
      )
    : null

  return (
    <div className="space-y-6">
      <DashboardHeader userName={`${user.firstName} ${user.lastName}`} departmentName={department?.name ?? null} />

      <Suspense fallback={<StatsSkeleton />}>
        <ManagerStats deptId={deptId ?? null} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-32 rounded-lg" />}>
        <ManagerAlerts deptId={deptId ?? null} />
      </Suspense>

      <QuickActionsPanel isDevMode={isDevMode} />

      {deptId && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Suspense fallback={<Skeleton className="h-40 rounded-lg" />}>
              <DepartmentAvailability deptId={deptId} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-40 rounded-lg" />}>
              <DepartmentTeams deptId={deptId} />
            </Suspense>
          </div>
          <Suspense fallback={<Skeleton className="h-32 rounded-lg" />}>
            <DepartmentUpcomingEvents deptId={deptId} />
          </Suspense>
        </>
      )}

      <Suspense fallback={<RecentAssignmentsSkeleton />}>
        <ManagerRecentAssignments deptId={deptId ?? null} />
      </Suspense>
    </div>
  )
}

async function DepartmentAvailability({ deptId }: { deptId: string }) {
  const vas = await cached(`dashboard:availability:${deptId}`, [CACHE_TAGS.vas, CACHE_TAGS.dashboard], 60, () =>
    prisma.vAProfile.findMany({
      where: { status: 'ACTIVE', user: { memberships: { some: { departmentId: deptId, endedAt: null } } } },
      select: { availabilityStatus: true, totalCapacityHours: true },
    })
  )

  const statusCounts: Record<string, number> = {}
  let fullTime = 0
  let partTime = 0
  for (const va of vas) {
    statusCounts[va.availabilityStatus] = (statusCounts[va.availabilityStatus] ?? 0) + 1
    const capacity = va.totalCapacityHours ? Number(va.totalCapacityHours) : FULL_TIME_CAPACITY_THRESHOLD_HOURS
    if (capacity >= FULL_TIME_CAPACITY_THRESHOLD_HOURS) fullTime++
    else partTime++
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Availability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {vas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No active VAs in this department.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {Object.entries(AVAILABILITY_STATUS_LABELS).map(([key, label]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {label}: {statusCounts[key] ?? 0}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {fullTime} full-time · {partTime} part-time
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

async function DepartmentTeams({ deptId }: { deptId: string }) {
  const teams = await cached(`dashboard:teams:${deptId}`, [CACHE_TAGS.teams, CACHE_TAGS.dashboard], 60, () =>
    prisma.team.findMany({
      where: { departmentId: deptId, status: 'ACTIVE' },
      include: {
        leader: { select: { firstName: true, lastName: true } },
        _count: { select: { memberships: { where: { endedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    })
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><UsersRound className="h-4 w-4" />Teams</CardTitle>
      </CardHeader>
      <CardContent className={teams.length === 0 ? undefined : 'p-0'}>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No teams in this department yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Team</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Leader</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id} className="border-b">
                  <TableCell className="py-2.5">
                    <Link href={`/teams/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                  </TableCell>
                  <TableCell className="py-2.5 text-sm text-muted-foreground">
                    {t.leader ? `${t.leader.firstName} ${t.leader.lastName}` : 'Unassigned'}
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm">{t._count.memberships}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

async function DepartmentUpcomingEvents({ deptId }: { deptId: string }) {
  const users = await cached(`dashboard:upcomingEvents:${deptId}`, [CACHE_TAGS.users, CACHE_TAGS.dashboard], 60, () =>
    prisma.user.findMany({
      where: { memberships: { some: { departmentId: deptId, endedAt: null } } },
      include: {
        vaProfile: true,
        employmentRecords: { where: { isCurrent: true }, take: 1 },
      },
    })
  )

  const now = new Date()
  type UpcomingEvent = { id: string; name: string; label: string; date: Date; daysUntil: number }
  const events: UpcomingEvent[] = []

  for (const u of users) {
    const currentEmploymentRecord = u.employmentRecords[0]
    let label: string | null = null
    let anchorDate: Date | null = null

    const vaHireDate = toValidDate(u.vaProfile?.currentHireDate)
    if (u.userType === 'VIRTUAL_ASSISTANT' && vaHireDate) {
      label = 'VA Anniversary'
      anchorDate = vaHireDate
    } else if (u.userType === 'INTERNAL_STAFF' && currentEmploymentRecord) {
      const staffStartDate = toValidDate(currentEmploymentRecord.startDate)
      if (staffStartDate) {
        label = 'Staff Anniversary'
        anchorDate = staffStartDate
      }
    }

    if (!label || !anchorDate) continue
    const next = nextOccurrence(anchorDate.getMonth(), anchorDate.getDate(), now)
    const daysUntil = Math.ceil((next.getTime() - now.getTime()) / 86400000)
    if (daysUntil > UPCOMING_EVENTS_WINDOW_DAYS) continue
    events.push({ id: u.id, name: `${u.firstName} ${u.lastName}`, label, date: next, daysUntil })
  }

  events.sort((a, b) => a.daysUntil - b.daysUntil)
  const upcoming = events.slice(0, 5)

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><CalendarHeart className="h-4 w-4" />Upcoming Anniversaries</CardTitle>
        <Link href="/celebrants" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No upcoming anniversaries in the next {UPCOMING_EVENTS_WINDOW_DAYS} days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                <div>
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{e.label} • {format(e.date, 'MMM d')}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {e.daysUntil === 0 ? 'Today' : `in ${e.daysUntil}d`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardHeader({ userName, departmentName }: { userName: string; departmentName: string | null }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back, {userName.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), 'EEEE, MMMM dd, yyyy')}
          {departmentName ? ` — ${departmentName} department` : ' — Operations overview'}
        </p>
      </div>
      {departmentName && (
        <Link href="/departments">
          <Button variant="outline" size="sm">
            <ArrowRight className="h-4 w-4 mr-2 rotate-180" />Switch department
          </Button>
        </Link>
      )}
    </div>
  )
}

async function ManagerStats({ deptId }: { deptId: string | null }) {
  const now = new Date()
  const periodStart = startOfMonth(now)
  const periodEnd = endOfMonth(now)

  const clientWhere: { status: 'ACTIVE'; departmentId?: string } = deptId
    ? { status: 'ACTIVE', departmentId: deptId }
    : { status: 'ACTIVE' }

  // Every cache key below is suffixed with the department scope — these were
  // static keys over deptId-varying `where` clauses, so one department's counts
  // were served to the next department that loaded the dashboard.
  const deptKey = deptId ?? 'all'

  const [clientCount, vaCount, activeAssignments, monthLogs] = await Promise.all([
    cached(`dashboard:clientCount:${deptKey}`, [CACHE_TAGS.clients, CACHE_TAGS.dashboard], 60, () => prisma.client.count({ where: clientWhere })),
    deptId
      ? cached(`dashboard:vaCount:${deptId}`, [CACHE_TAGS.vas, CACHE_TAGS.dashboard], 60, () =>
          prisma.vAProfile.count({ where: { status: 'ACTIVE', user: { memberships: { some: { departmentId: deptId, endedAt: null } } } } })
        )
      : cached('dashboard:vaCount', [CACHE_TAGS.vas, CACHE_TAGS.dashboard], 60, () => prisma.vAProfile.count({ where: { status: 'ACTIVE' } })),
    cached(`dashboard:activeAssignments:${deptKey}`, [CACHE_TAGS.assignments, CACHE_TAGS.dashboard], 60, () =>
      prisma.assignment.findMany({
        where: { status: 'ACTIVE', ...(deptId ? { client: { departmentId: deptId } } : {}) },
        include: { vaProfile: { include: { user: true } }, client: true, workLogs: { where: { workDate: { gte: periodStart, lte: periodEnd } } } },
      })
    ),
    cached(`dashboard:monthLogs:${deptKey}`, [CACHE_TAGS.worklogs, CACHE_TAGS.dashboard], 60, () =>
      deptId
        ? prisma.workLog.findMany({ where: { workDate: { gte: periodStart, lte: periodEnd }, assignment: { client: { departmentId: deptId } } } })
        : prisma.workLog.findMany({ where: { workDate: { gte: periodStart, lte: periodEnd } } })
    ),
  ])

  const totalMonthHours = monthLogs.reduce((s, l) => s + Number(l.hours), 0)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 fade-in-stagger">
      <StatCard icon={Building2} label="Active Clients" value={clientCount} href="/clients" />
      <StatCard icon={Users} label="Active VAs" value={vaCount} href="/vas" />
      <StatCard icon={Briefcase} label="Active Assignments" value={activeAssignments.length} href="/assignments" />
      <StatCard icon={Clock} label="Hours this Month" value={totalMonthHours.toFixed(1)} href="/reports" />
    </div>
  )
}

async function ManagerAlerts({ deptId }: { deptId: string | null }) {
  const now = new Date()
  const periodStart = startOfMonth(now)
  const periodEnd = endOfMonth(now)

  const activeAssignments = await cached(`dashboard:activeAssignments:${deptId ?? 'all'}`, [CACHE_TAGS.assignments, CACHE_TAGS.dashboard], 60, () =>
    prisma.assignment.findMany({
      where: { status: 'ACTIVE', ...(deptId ? { client: { departmentId: deptId } } : {}) },
      include: { vaProfile: { include: { user: true } }, client: true, workLogs: { where: { workDate: { gte: periodStart, lte: periodEnd } } } },
    })
  )

  const overUtilized = activeAssignments.filter((a) => {
    const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
    const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
    return logged > target && target > 0
  })

  const underUtilized = activeAssignments.filter((a) => {
    const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
    const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
    const daysInMonth = endOfMonth(now).getDate()
    const day = now.getDate()
    const expectedProgress = (day / daysInMonth) * target
    return target > 0 && logged < expectedProgress * 0.5 && day > 7
  })

  if (overUtilized.length === 0 && underUtilized.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-warning" />Attention Needed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {overUtilized.map((a) => {
          const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
          const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
          return (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
              <div>
                <p className="text-sm font-medium">{a.client.name}</p>
                <p className="text-xs text-muted-foreground">{a.vaProfile.user.firstName} — {logged.toFixed(1)}h / {target.toFixed(1)}h ({((logged/target)*100).toFixed(0)}%)</p>
              </div>
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/20">Over target</Badge>
            </div>
          )
        })}
        {underUtilized.slice(0, 3).map((a) => {
          const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
          const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
          return (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-info/10 border border-info/20">
              <div>
                <p className="text-sm font-medium">{a.client.name}</p>
                <p className="text-xs text-muted-foreground">{a.vaProfile.user.firstName} — {logged.toFixed(1)}h / {target.toFixed(1)}h</p>
              </div>
              <Badge variant="outline" className="bg-info/15 text-info border-info/20">Behind pace</Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function QuickActionsPanel({ isDevMode }: { isDevMode: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-3">
        {isDevMode && <><QuickAction href="/clients/new" icon={Plus} label="Add Client" /><QuickAction href="/vas" icon={Plus} label="Add VA" /><QuickAction href="/assignments/new" icon={Briefcase} label="New Assignment" /></>}
        <QuickAction href="/work-logs/new" icon={Clock} label="Log Hours" />
        <QuickAction href="/reports" icon={BarChart3} label="Monthly Report" />
        <QuickAction href="/skills" icon={Users} label="Manage Services" />
      </CardContent>
    </Card>
  )
}

async function ManagerRecentAssignments({ deptId }: { deptId: string | null }) {
  const recentAssignments = await cached(`dashboard:recentAssignments:${deptId ?? 'all'}`, [CACHE_TAGS.assignments, CACHE_TAGS.dashboard], 60, () =>
    prisma.assignment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      ...(deptId ? { where: { client: { departmentId: deptId } } } : {}),
      include: { client: true, vaProfile: { include: { user: true } } },
    })
  )

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Assignments</CardTitle>
        <Link href="/assignments" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
      </CardHeader>
      <CardContent>
        {recentAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No assignments yet.</p>
        ) : (
          <div className="space-y-2">
            {recentAssignments.map((a) => (
              <Link key={a.id} href={`/assignments/${a.id}`} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{a.client.name}</p>
                  <p className="text-xs text-muted-foreground">{a.vaProfile.user.firstName} • {a.type} • {Number(a.agreedHours)}h agreed</p>
                </div>
                <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'}>{a.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function VADashboard({ userId, vaProfileId }: { userId: string; vaProfileId: string }) {
  const now = new Date()
  const periodStart = startOfMonth(now)
  const periodEnd = endOfMonth(now)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [va, assignments, monthLogs, todayLogs] = await Promise.all([
    cached(`dashboard:vaProfile:${vaProfileId}`, [CACHE_TAGS.vas, CACHE_TAGS.dashboard], 60, () =>
      prisma.vAProfile.findUnique({ where: { id: vaProfileId }, include: { user: true, vaSkills: true } })
    ),
    cached(`dashboard:vaAssignments:${vaProfileId}`, [CACHE_TAGS.assignments, CACHE_TAGS.dashboard], 60, () =>
      prisma.assignment.findMany({ where: { vaProfileId, status: 'ACTIVE' }, include: { client: true, workLogs: { where: { workDate: { gte: periodStart, lte: periodEnd } } } } })
    ),
    cached(`dashboard:vaMonthLogs:${vaProfileId}`, [CACHE_TAGS.worklogs, CACHE_TAGS.dashboard], 60, () =>
      prisma.workLog.findMany({ where: { vaProfileId, workDate: { gte: periodStart, lte: periodEnd } } })
    ),
    cached(`dashboard:vaTodayLogs:${vaProfileId}`, [CACHE_TAGS.worklogs, CACHE_TAGS.dashboard], 60, () =>
      prisma.workLog.findMany({ where: { vaProfileId, workDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } } })
    ),
  ])

  if (!va) return null
  const totalMonthHours = monthLogs.reduce((s, l) => s + Number(l.hours), 0)
  const todayHours = todayLogs.reduce((s, l) => s + Number(l.hours), 0)

  const monthlyTarget = assignments.reduce((s, a) => s + (a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)), 0)
  const monthPct = monthlyTarget > 0 ? Math.min((totalMonthHours / monthlyTarget) * 100, 100) : 0
  const monthColor = monthPct > 100 ? 'text-warning' : monthPct >= 80 ? 'text-success' : 'text-info'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Hi {va.user.firstName || 'there'}</h2>
        <p className="text-sm text-muted-foreground mt-1">{format(now, 'EEEE, MMMM dd, yyyy')}</p>
      </div>

      <Card className="bg-gradient-to-br from-gray-900 to-gray-700 text-white border-0">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <CircularProgress
                value={monthPct}
                size={88}
                strokeWidth={7}
                colorClassName={monthlyTarget > 0 ? monthColor : 'text-white/40'}
                trackClassName="text-white/15"
              >
                <span className="text-lg font-bold">{monthlyTarget > 0 ? `${monthPct.toFixed(0)}%` : '—'}</span>
              </CircularProgress>
              <div>
                <p className="text-sm text-white/70">Today so far</p>
                <p className="text-4xl font-bold mt-1">{todayHours.toFixed(1)}h</p>
                <p className="text-sm text-white/70 mt-2">{todayLogs.length === 0 ? "You haven't logged any hours today." : `${todayLogs.length} entr${todayLogs.length === 1 ? 'y' : 'ies'} logged`}</p>
              </div>
            </div>
            <Link href="/work-logs/new"><Button size="lg" className="bg-white text-gray-900 hover:bg-white/90"><Plus className="h-4 w-4 mr-2" />Log Hours</Button></Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMonthHours.toFixed(1)}h</p>
            {monthlyTarget > 0 && <p className="text-xs text-muted-foreground mt-1">of {monthlyTarget.toFixed(0)}h target</p>}
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{assignments.length}</p></CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">My Skills</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{va.vaSkills.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">My Assignments</CardTitle></CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">You don&apos;t have any active assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => {
                const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
                const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
                const pct = target > 0 ? Math.min((logged / target) * 100, 100) : 0
                const ringColor = pct > 100 ? 'text-warning' : pct >= 80 ? 'text-success' : 'text-info'
                const badgeClass = pct > 100 ? 'bg-warning/15 text-warning border-warning/20' : pct >= 80 ? 'bg-success/15 text-success border-success/20' : 'bg-info/15 text-info border-info/20'
                return (
                  <Link key={a.id} href={`/assignments/${a.id}`} className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                    <CircularProgress value={pct} size={48} strokeWidth={4} colorClassName={ringColor} className="shrink-0">
                      <span className="text-[10px] font-semibold">{pct.toFixed(0)}%</span>
                    </CircularProgress>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.type} • {a.notes ?? ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{logged.toFixed(1)}h / {target.toFixed(0)}h</p>
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 mt-1 ${badgeClass}`}>
                        {pct > 100 ? 'Over target' : pct >= 80 ? 'On track' : 'Behind pace'}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; href: string }) {
  return (
    <Link href={href}>
      <Card className="card-hover group/stat bg-gradient-to-br from-card to-muted/40">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted transition-transform group-hover/stat:scale-110">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
      </Card>
    </Link>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link href={href}><Button variant="outline" className="w-full justify-start gap-2 h-12"><Icon className="h-4 w-4" />{label}</Button></Link>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1,2,3,4].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  )
}

function RecentAssignmentsSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <Skeleton className="h-5 w-36" />
      {[1,2,3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-56" /></div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function VADashSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="rounded-lg bg-gray-800 p-6 flex items-center gap-5">
        <Skeleton className="h-22 w-22 rounded-full bg-white/10 shrink-0" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 bg-white/10" /><Skeleton className="h-10 w-20 bg-white/10" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1,2,3].map((i) => (
          <div key={i} className="rounded-lg border p-5 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-12" /></div>
        ))}
      </div>
    </div>
  )
}
