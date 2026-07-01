import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Building2,
  Users,
  Briefcase,
  Clock,
  BarChart3,
  Plus,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import { startOfMonth, endOfMonth, format, isAfter } from 'date-fns'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>
}) {
  const params = await searchParams
  const deptId = params.dept

  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Not authenticated.</p>
      </div>
    )
  }

  if (['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole) && !deptId) {
    redirect('/departments')
  }

  if (user.userType === 'VIRTUAL_ASSISTANT') return <VADashboard userId={user.id} vaProfileId={user.vaProfile!.id} />

  const department = deptId
    ? await cached('dashboard:department', [CACHE_TAGS.departments, CACHE_TAGS.dashboard], 30, () =>
        prisma.department.findUnique({ where: { id: deptId } })
      )
    : null

  return (
    <ManagerDashboard
      managerId={user.id}
      userName={`${user.firstName} ${user.lastName}`}
      isDevMode={isDevMode}
      deptId={deptId ?? null}
      departmentName={department?.name ?? null}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// MANAGER DASHBOARD
// ─────────────────────────────────────────────────────────────
async function ManagerDashboard({
  managerId,
  userName,
  isDevMode,
  deptId,
  departmentName,
}: {
  managerId: string
  userName: string
  isDevMode: boolean
  deptId: string | null
  departmentName: string | null
}) {
  const now = new Date()
  const periodStart = startOfMonth(now)
  const periodEnd = endOfMonth(now)

  const clientWhere = deptId
    ? { isActive: true, departmentId: deptId }
    : { isActive: true }

  const [clientCount, vaCount, activeAssignments, monthLogs, recentAssignments] = await Promise.all([
    cached('dashboard:clientCount', [CACHE_TAGS.clients, CACHE_TAGS.dashboard], 30, () =>
      prisma.client.count({ where: clientWhere })
    ),
    deptId
      ? cached('dashboard:vaCount:dept', [CACHE_TAGS.vas, CACHE_TAGS.dashboard], 30, () =>
          prisma.vAProfile.count({
            where: {
              isActive: true,
              user: {
                memberships: { some: { departmentId: deptId, endedAt: null } },
              },
            },
          })
        )
      : cached('dashboard:vaCount', [CACHE_TAGS.vas, CACHE_TAGS.dashboard], 30, () =>
          prisma.vAProfile.count({ where: { isActive: true } })
        ),
    cached('dashboard:activeAssignments', [CACHE_TAGS.assignments, CACHE_TAGS.dashboard], 30, () =>
      prisma.assignment.findMany({
        where: {
          status: 'ACTIVE',
          ...(deptId ? { client: { departmentId: deptId } } : {}),
        },
        include: {
          vaProfile: { include: { user: true } },
          client: true,
          workLogs: { where: { workDate: { gte: periodStart, lte: periodEnd } } },
        },
      })
    ),
    cached('dashboard:monthLogs', [CACHE_TAGS.worklogs, CACHE_TAGS.dashboard], 30, () =>
      deptId
        ? prisma.workLog.findMany({
            where: {
              workDate: { gte: periodStart, lte: periodEnd },
              assignment: { client: { departmentId: deptId } },
            },
          })
        : prisma.workLog.findMany({
            where: { workDate: { gte: periodStart, lte: periodEnd } },
          })
    ),
    cached('dashboard:recentAssignments', [CACHE_TAGS.assignments, CACHE_TAGS.dashboard], 30, () =>
      prisma.assignment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        ...(deptId ? { where: { client: { departmentId: deptId } } } : {}),
        include: { client: true, vaProfile: { include: { user: true } } },
      })
    ),
  ])

  const totalMonthHours = monthLogs.reduce((s, l) => s + Number(l.hours), 0)

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, {userName.split(' ')[0]}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {format(now, 'EEEE, MMMM dd, yyyy')}
            {departmentName ? ` — ${departmentName} department` : ' — Operations overview'}
          </p>
        </div>
        {departmentName && (
          <Link href="/departments">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              Switch department
            </Button>
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Active Clients"
          value={clientCount}
          href="/clients"
        />
        <StatCard
          icon={Users}
          label="Active VAs"
          value={vaCount}
          href="/vas"
        />
        <StatCard
          icon={Briefcase}
          label="Active Assignments"
          value={activeAssignments.length}
          href="/assignments"
        />
        <StatCard
          icon={Clock}
          label="Hours this Month"
          value={totalMonthHours.toFixed(1)}
          href="/reports"
        />
      </div>

      {/* Alerts */}
      {(overUtilized.length > 0 || underUtilized.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              Attention Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overUtilized.map((a) => {
              const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
              const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
              return (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div>
                    <p className="text-sm font-medium">{a.client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.vaProfile.user.firstName} — {logged.toFixed(1)}h / {target.toFixed(1)}h ({((logged/target)*100).toFixed(0)}%)
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-orange-500/15 text-orange-700 border-orange-500/20">
                    Over target
                  </Badge>
                </div>
              )
            })}
            {underUtilized.slice(0, 3).map((a) => {
              const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
              const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
              return (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div>
                    <p className="text-sm font-medium">{a.client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.vaProfile.user.firstName} — {logged.toFixed(1)}h / {target.toFixed(1)}h
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/20">
                    Behind pace
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {isDevMode && (
            <>
              <QuickAction href="/clients/new" icon={Plus} label="Add Client" />
              <QuickAction href="/vas/new" icon={Plus} label="Add VA" />
              <QuickAction href="/assignments/new" icon={Briefcase} label="New Assignment" />
            </>
          )}
          <QuickAction href="/work-logs/new" icon={Clock} label="Log Hours" />
          <QuickAction href="/reports" icon={BarChart3} label="Monthly Report" />
          <QuickAction href="/skills" icon={Users} label="Manage Services" />
        </CardContent>
      </Card>

      {/* Recent assignments */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Assignments</CardTitle>
          <Link href="/assignments" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {recentAssignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/assignments/${a.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{a.client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.vaProfile.user.firstName} • {a.type} • {Number(a.agreedHours)}h agreed
                    </p>
                  </div>
                  <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {a.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VA DASHBOARD
// ─────────────────────────────────────────────────────────────
async function VADashboard({
  userId,
  vaProfileId,
}: {
  userId: string
  vaProfileId: string
}) {
  const now = new Date()
  const periodStart = startOfMonth(now)
  const periodEnd = endOfMonth(now)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [va, assignments, monthLogs, todayLogs] = await Promise.all([
    cached('dashboard:vaProfile', [CACHE_TAGS.vas, CACHE_TAGS.dashboard], 30, () =>
      prisma.vAProfile.findUnique({
        where: { id: vaProfileId },
        include: { user: true, vaSkills: true },
      })
    ),
    cached('dashboard:vaAssignments', [CACHE_TAGS.assignments, CACHE_TAGS.dashboard], 30, () =>
      prisma.assignment.findMany({
        where: { vaProfileId, status: 'ACTIVE' },
        include: {
          client: true,
          workLogs: {
            where: { workDate: { gte: periodStart, lte: periodEnd } },
          },
        },
      })
    ),
    cached('dashboard:vaMonthLogs', [CACHE_TAGS.worklogs, CACHE_TAGS.dashboard], 30, () =>
      prisma.workLog.findMany({
        where: {
          vaProfileId,
          workDate: { gte: periodStart, lte: periodEnd },
        },
      })
    ),
    cached('dashboard:vaTodayLogs', [CACHE_TAGS.worklogs, CACHE_TAGS.dashboard], 30, () =>
      prisma.workLog.findMany({
        where: {
          vaProfileId,
          workDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
        },
      })
    ),
  ])

  if (!va) return null

  const totalMonthHours = monthLogs.reduce((s, l) => s + Number(l.hours), 0)
  const todayHours = todayLogs.reduce((s, l) => s + Number(l.hours), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Hi {va.user.firstName || 'there'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {format(now, 'EEEE, MMMM dd, yyyy')}
        </p>
      </div>

      {/* Hero CTA — log hours */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-700 text-white border-0">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Today so far</p>
              <p className="text-4xl font-bold mt-1">{todayHours.toFixed(1)}h</p>
              <p className="text-sm text-white/70 mt-2">
                {todayLogs.length === 0
                  ? "You haven't logged any hours today."
                  : `${todayLogs.length} entr${todayLogs.length === 1 ? 'y' : 'ies'} logged`}
              </p>
            </div>
            <Link href={`/work-logs/new`}>
              <Button size="lg" className="bg-white text-gray-900 hover:bg-white/90">
                <Plus className="h-4 w-4 mr-2" />
                Log Hours
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* My stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMonthHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{assignments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{va.vaSkills.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* My assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              You don't have any active assignments yet.
            </p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => {
                const logged = a.workLogs.reduce((s, l) => s + Number(l.hours), 0)
                const target = a.monthlyHours ? Number(a.monthlyHours) : Number(a.agreedHours)
                const pct = target > 0 ? Math.min((logged / target) * 100, 100) : 0
                return (
                  <Link
                    key={a.id}
                    href={`/assignments/${a.id}`}
                    className="block p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold">{a.client.name}</p>
                        <p className="text-xs text-muted-foreground">{a.type} • {a.notes ?? ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{logged.toFixed(1)}h / {target.toFixed(0)}h</p>
                        <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% of target</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          pct > 100 ? 'h-full bg-orange-500' :
                          pct >= 80 ? 'h-full bg-green-500' :
                          'h-full bg-blue-500'
                        }
                        style={{ width: `${pct}%` }}
                      />
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

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  href: string
}) {
  return (
    <Link href={href}>
      <Card className="card-hover">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link href={href}>
      <Button variant="outline" className="w-full justify-start gap-2 h-12">
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    </Link>
  )
}
