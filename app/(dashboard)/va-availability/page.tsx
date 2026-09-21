import {
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  VA_MUTATOR_ROLES,
} from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAvailabilityRows } from '@/lib/va-availability'
import { computeAvailabilitySummary } from '@/lib/va-availability-fields'
import { AvailabilityBoard } from '@/components/va-availability/AvailabilityBoard'
import { StatCard } from '@/components/ui/stat-card'
import { CalendarRange, Users, UserCheck, Briefcase, PlaneTakeoff, Clock, AlertTriangle, Star } from 'lucide-react'

// The DMF sheet's "VA Availability" tab: the per-VA hours ledger the
// dashboard's Headcount card only shows in aggregate.
export default async function VAAvailabilityPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const unrestricted = isDepartmentUnrestricted(user)
  const managedIds = getManagedDepartmentIds(user)
  const canMutate = VA_MUTATOR_ROLES.includes(user.systemRole)

  const rows = await getAvailabilityRows(unrestricted ? null : managedIds)
  const summary = computeAvailabilitySummary(rows)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarRange className="h-6 w-6" />
          VA Availability
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Preferred vs booked hours, remaining capacity, and recommendation status
          {unrestricted ? ' across every department' : ''}.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7 fade-in-stagger">
        <StatCard icon={Users} label="Total VAs" value={summary.total} />
        <StatCard icon={UserCheck} label="Available" value={summary.available} />
        <StatCard icon={Briefcase} label="Fully Assigned" value={summary.fullyAssigned} />
        <StatCard icon={PlaneTakeoff} label="On Leave" value={summary.onLeave} />
        <StatCard icon={Clock} label="Bench Hours" value={summary.totalAvailableHours} />
        <StatCard icon={AlertTriangle} label="Needs Review" value={summary.needsReview} />
        <StatCard icon={Star} label="Recommended" value={summary.recommended} />
      </div>

      <AvailabilityBoard
        rows={rows}
        canMutate={canMutate}
        showDepartment={unrestricted || managedIds.length > 1}
      />
    </div>
  )
}
