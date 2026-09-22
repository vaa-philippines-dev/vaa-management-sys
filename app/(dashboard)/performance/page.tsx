import {
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  ASSIGNMENT_MUTATOR_ROLES,
} from '@/lib/auth'
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

  const unrestricted = isDepartmentUnrestricted(user)
  const managedIds = getManagedDepartmentIds(user)
  const canMutate = ASSIGNMENT_MUTATOR_ROLES.includes(user.systemRole)

  const rows = await getPerformanceRows(unrestricted ? null : managedIds)
  const summary = computePerformanceSummary(rows)

  return (
    <div data-wide-page className="space-y-6">
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
        showDepartment={unrestricted || managedIds.length > 1}
      />
    </div>
  )
}
