import {
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  VA_MUTATOR_ROLES,
} from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAvailabilityRows } from '@/lib/va-availability'
import { AvailabilityBoard } from '@/components/va-availability/AvailabilityBoard'
import { CalendarRange } from 'lucide-react'

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

      <AvailabilityBoard
        rows={rows}
        canMutate={canMutate}
        showDepartment={unrestricted || managedIds.length > 1}
      />
    </div>
  )
}
