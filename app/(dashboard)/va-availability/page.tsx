import {
  getCurrentUser,
  VA_MUTATOR_ROLES,
  DMF_RECORD_DELETE_ROLES,
  RECOMMENDATION_MUTATOR_ROLES,
} from '@/lib/auth'
import { getViewScope } from '@/lib/scope'
import { redirect } from 'next/navigation'
import { getAvailabilityRows } from '@/lib/va-availability'
import { computeAvailabilitySummary } from '@/lib/va-availability-fields'
import { AvailabilityBoard } from '@/components/va-availability/AvailabilityBoard'
import { StatCard } from '@/components/ui/stat-card'
import { CalendarRange, Users, UserCheck, Briefcase, PauseCircle, Clock, AlertTriangle, Star } from 'lucide-react'

// The DMF sheet's "VA Availability" tab: the per-VA hours ledger the
// dashboard's Headcount card only shows in aggregate.
export default async function VAAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ review?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  // lib/scope.ts: admins/HR/EXECUTIVE everything, DM/OM/Staff their
  // departments, a Team Leader only the people on the teams they lead.
  const scope = await getViewScope(user)
  const unrestricted = scope === null
  const canMutate = VA_MUTATOR_ROLES.includes(user.systemRole)
  // Admins can remove a row from this list and restore it from "Removed".
  const canDelete = DMF_RECORD_DELETE_ROLES.includes(user.systemRole)
  const canRecommend = RECOMMENDATION_MUTATOR_ROLES.includes(user.systemRole)

  const rows = await getAvailabilityRows(
    scope === null
      ? { departmentIds: null, includeHidden: canDelete }
      : {
          departmentIds: scope.departmentIds,
          includeHidden: canDelete,
          ...(scope.userIds !== null && { userIds: scope.userIds }),
        }
  )
  const summary = computeAvailabilitySummary(rows.filter((r) => !r.hidden))

  return (
    <div data-wide-page className="space-y-6">
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
        <StatCard icon={PauseCircle} label="On Hold" value={summary.onHold} />
        <StatCard icon={Clock} label="Bench Hours" value={summary.totalAvailableHours} />
        <StatCard icon={AlertTriangle} label="Needs Review" value={summary.needsReview} />
        <StatCard icon={Star} label="Recommended" value={summary.recommended} />
      </div>

      <AvailabilityBoard
        rows={rows}
        canMutate={canMutate}
        canDelete={canDelete}
        canRecommend={canRecommend}
        showDepartment={unrestricted || scope.departmentIds.length > 1}
        // ?review=due — the bell's availability-review notification lands here.
        initialAlertsOnly={(await searchParams).review === 'due'}
      />
    </div>
  )
}
