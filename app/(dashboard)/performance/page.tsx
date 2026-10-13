import { getCurrentUser, ASSIGNMENT_MUTATOR_ROLES, KPI_SCHEDULE_ROLES } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LEVEL_RECORD_NAMES } from '@/lib/departments'
import { resolveKpiMilestones } from '@/lib/kpi-checks-labels'
import { KpiScheduleButton } from '@/components/performance/KpiScheduleButton'
import { getViewScope, getMutateScope } from '@/lib/scope'
import { redirect } from 'next/navigation'
import { getPerformanceRows } from '@/lib/performance'
import { computePerformanceSummary } from '@/lib/performance-fields'
import { PerformanceBoard } from '@/components/performance/PerformanceBoard'
import { StatCard } from '@/components/ui/stat-card'
import { LineChart, Users, CheckCircle2, AlertTriangle, Clock, Megaphone } from 'lucide-react'

// The DMF sheet's "Performance Monitoring" tab in full: the KPI check-in
// grid (which until now only existed as a dashboard card) plus the 2nd-week
// and 6th-month client feedback cycles, which were never ported at all.
export default async function PerformancePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const scope = await getViewScope(user)
  const unrestricted = scope === null
  const canMutate = ASSIGNMENT_MUTATOR_ROLES.includes(user.systemRole)

  const rows = await getPerformanceRows(scope)
  const summary = computePerformanceSummary(rows)

  // Departments whose KPI check-in schedule this user may set (FB-0015).
  let scheduleDepartments: { id: string; name: string; milestones: ReturnType<typeof resolveKpiMilestones> }[] = []
  if (KPI_SCHEDULE_ROLES.includes(user.systemRole)) {
    const mutateScope = await getMutateScope(user)
    const departments = await prisma.department.findMany({
      where: {
        status: 'ACTIVE',
        name: { notIn: LEVEL_RECORD_NAMES },
        ...(mutateScope ? { id: { in: mutateScope.departmentIds } } : {}),
      },
      select: { id: true, name: true, kpiMilestones: true },
      orderBy: { name: 'asc' },
    })
    scheduleDepartments = departments.map((d) => ({ id: d.id, name: d.name, milestones: resolveKpiMilestones(d.kpiMilestones) }))
  }

  return (
    <div data-wide-page className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LineChart className="h-6 w-6" />
            Performance Monitoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            KPI check-ins and client feedback per engagement
            {unrestricted ? ' across every department' : ''}.
          </p>
        </div>
        <KpiScheduleButton departments={scheduleDepartments} />
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 fade-in-stagger">
        <StatCard icon={Users} label="Engagements" value={summary.engagements} />
        <StatCard
          icon={CheckCircle2}
          label="KPI Check-ins Done"
          value={`${summary.kpiChecksDone}/${summary.kpiChecksTotal}`}
        />
        <StatCard icon={AlertTriangle} label="Overdue Check-ins" value={summary.overdueEngagements} />
        <StatCard icon={Clock} label="Late Check-ins" value={summary.lateCheckIns} />
        <StatCard icon={Megaphone} label="Feedback Not Relayed" value={summary.feedbackAwaitingRelay} />
      </div>

      <PerformanceBoard
        rows={rows}
        canMutate={canMutate}
        showDepartment={unrestricted || scope.departmentIds.length > 1}
      />
    </div>
  )
}
