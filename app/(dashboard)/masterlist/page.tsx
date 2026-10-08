import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, STAFF_MUTATOR_ROLES } from '@/lib/auth'
import { isTeamScoped, assignmentScopeWhere, type Scope } from '@/lib/scope'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { getVisibleStaffPeople, getStaffViewScope } from '@/lib/staff'
import { ON_HOLD_AVAILABILITY } from '@/lib/va-availability-fields'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { Clock, Contact, Handshake, UserCog, Users, UsersRound } from 'lucide-react'
import { StaffSection, STAFF_PARAM_KEYS } from './StaffSection'
import { VASection, VA_PARAM_KEYS, getViewerScope, buildScopeWhere, scopeKey, type ViewerScope } from './VASection'

// One roster for everyone: the Staff table, then the VA table, under a shared
// row of scorecards. Each table keeps its own filters, sort and paging in its
// own URL params (Staff's are s-prefixed), so changing one never resets the
// other. /vas and /staff redirect here; the profile pages stay at
// /vas/[id] and /staff/[id].
export default async function MasterlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const params = await searchParams
  const viewerScope = await getViewerScope(currentUser)
  // The staff directory is company-wide, so it stays closed to whoever the
  // old Staff Masterlist turned away: VA accounts and a team-scoped Team
  // Leader (whose view stops at their own team).
  const showStaff = currentUser.userType !== 'VIRTUAL_ASSISTANT' && !isTeamScoped(currentUser)
  // A Dept/Ops Manager sees only their own departments' staff; admins/HR/
  // EXECUTIVE (and STAFF-role accounts) see everyone.
  const staffScope = await getStaffViewScope(currentUser)
  const canEditStaff = STAFF_MUTATOR_ROLES.includes(currentUser.systemRole)

  const pick = (keys: string[]) => {
    const sp = new URLSearchParams()
    for (const k of keys) {
      const v = params[k]
      if (typeof v === 'string') sp.set(k, v)
    }
    return sp.toString()
  }

  return (
    <div data-wide-page className="space-y-6">
      <Suspense fallback={<StatsSkeleton count={showStaff ? 7 : 4} />}>
        <MasterlistStats viewerScope={viewerScope} showStaff={showStaff} staffScope={staffScope} />
      </Suspense>

      {showStaff && (
        <Suspense fallback={<SectionSkeleton />}>
          <StaffSection scope={staffScope} canEdit={canEditStaff} params={params} keep={pick(VA_PARAM_KEYS)} />
        </Suspense>
      )}

      <VASection currentUser={currentUser} viewerScope={viewerScope} params={params} keep={showStaff ? pick(STAFF_PARAM_KEYS) : ''} />
    </div>
  )
}

// Whole-roster scorecards, independent of either table's filters but in the
// same scope as each table: a Dept/Ops Manager's figures cover only their
// own departments.
async function MasterlistStats({ viewerScope, showStaff, staffScope }: { viewerScope: ViewerScope; showStaff: boolean; staffScope: Scope }) {
  const scopeAnd: Prisma.VAProfileWhereInput = viewerScope.type === 'unrestricted' ? {} : { AND: [buildScopeWhere(viewerScope)] }
  // A Dept/Ops Manager counts their departments' clients (an assignment's
  // department is its client's); team/self viewers count their teammates'.
  const connectionScope: Prisma.AssignmentWhereInput =
    viewerScope.type === 'department' ? assignmentScopeWhere(viewerScope.scope)
    : viewerScope.type === 'unrestricted' ? {}
    : { vaProfile: buildScopeWhere(viewerScope) }

  const people = showStaff ? await getVisibleStaffPeople(staffScope) : []
  const activeStaff = people.filter((p) => p.latest.generalStatus === 'ACTIVE')
  // Team Leaders on staff keep their VA account, so they're counted once in
  // Total Active, not as both an active VA and active staff.
  const activeStaffVAUserIds = activeStaff
    .filter((p) => p.latest.user?.userType === 'VIRTUAL_ASSISTANT')
    .map((p) => p.latest.userId!)
    .sort()

  const [activeVAs, idleVAs, overallVAs, connections, activeInBoth] = await cached(
    `masterlist:stats:${scopeKey(viewerScope)}:${activeStaffVAUserIds.join(',')}`,
    [CACHE_TAGS.vas, CACHE_TAGS.assignments],
    60,
    () =>
      Promise.all([
        prisma.vAProfile.count({ where: { user: { userType: 'VIRTUAL_ASSISTANT' }, status: 'ACTIVE', ...scopeAnd } }),
        // Same IDLE definition as lib/team-assignments.ts's classifyAssignmentState()
        // — active profile, not on hold/unavailable, zero active assignments.
        prisma.vAProfile.count({
          where: {
            user: { userType: 'VIRTUAL_ASSISTANT' },
            status: 'ACTIVE',
            availabilityStatus: { notIn: [...ON_HOLD_AVAILABILITY, 'UNAVAILABLE'] },
            assignments: { none: { status: 'ACTIVE' } },
            ...scopeAnd,
          },
        }),
        // Everyone who has ever been a VA, whatever their status now.
        prisma.vAProfile.count({ where: { user: { userType: 'VIRTUAL_ASSISTANT' }, ...scopeAnd } }),
        // One per active VA–client assignment: a VA with three clients counts
        // three times, a client with two VAs twice. Only active VAs — an
        // assignment left open after its VA resigned isn't a live connection.
        prisma.assignment.count({
          where: {
            AND: [
              { status: 'ACTIVE', vaProfile: { status: 'ACTIVE', user: { userType: 'VIRTUAL_ASSISTANT' } } },
              connectionScope,
            ],
          },
        }),
        activeStaffVAUserIds.length > 0
          ? prisma.vAProfile.count({
              where: { userId: { in: activeStaffVAUserIds }, user: { userType: 'VIRTUAL_ASSISTANT' }, status: 'ACTIVE', ...scopeAnd },
            })
          : Promise.resolve(0),
      ])
  )

  if (!showStaff) {
    return (
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 fade-in-stagger">
        <StatCard icon={UserCog} label="Active VAs" value={activeVAs} href="/masterlist?status=ACTIVE#va" />
        <StatCard icon={Clock} label="Idle VAs" value={idleVAs} />
        <StatCard icon={Handshake} label="Active Connections" value={connections} />
        <StatCard icon={Users} label="Overall VAs" value={overallVAs} href="/masterlist?status=ALL#va" />
      </div>
    )
  }

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7 fade-in-stagger">
      <StatCard icon={UsersRound} label="Total Active" value={activeVAs + activeStaff.length - activeInBoth} />
      <StatCard icon={UserCog} label="Active VAs" value={activeVAs} href="/masterlist?status=ACTIVE#va" />
      <StatCard icon={Contact} label="Active Staff" value={activeStaff.length} href="/masterlist?sstatus=ACTIVE#staff" />
      <StatCard icon={Clock} label="Idle VAs" value={idleVAs} />
      <StatCard icon={Handshake} label="Active Connections" value={connections} />
      <StatCard icon={Users} label="Overall VAs" value={overallVAs} href="/masterlist?status=ALL#va" />
      <StatCard icon={Users} label="Overall Staff" value={people.length} href="/masterlist?sstatus=ALL#staff" />
    </div>
  )
}

function StatsSkeleton({ count }: { count: number }) {
  return (
    <div className={`grid gap-3 grid-cols-2 md:grid-cols-4 ${count > 4 ? 'xl:grid-cols-7' : ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="rounded-lg border bg-card p-2 space-y-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-40 hidden md:block" />
            <Skeleton className="h-5 w-16 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
