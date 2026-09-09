import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cached, CACHE_TAGS } from '@/lib/cache'

// Mirrors the DMF sheet's "HEADCOUNT" box (Employed / Active-Available /
// Active-No Client / Full, then an Availability breakdown by full-time vs
// part-time capacity) rather than the previous generic Availability-status
// tally, so a DM/OM sees the same categories they already work from.
//
// "ACTIVE - AVAILABLE" (availabilityStatus-based) and "ACTIVE - NO CLIENT"
// (Assignment-based) are deliberately two different signals, same as the
// sheet distinguishes them — a gap between the two flags exactly the kind of
// stale-data mismatch getDepartmentTeamAssignments() already surfaces
// per-VA; this card reports the aggregate view of the same thing.
//
// Full-time/part-time buckets are inferred from totalCapacityHours (no
// discrete field exists): >=35h/week matches the schema's own full-time
// default (see FULL_TIME_CAPACITY_THRESHOLD_HOURS convention elsewhere in
// this dashboard); 20-35h is treated as "part-time (<8hrs/day)" and <20h as
// "part-time (<4hrs/day)" as a 5-day-week approximation of the sheet's
// per-day hour labels — flag if these thresholds should be different.
const FULL_TIME_HOURS = 35
const PART_TIME_8HR_FLOOR_HOURS = 20

export async function DepartmentHeadcountCard({ deptId }: { deptId: string }) {
  const vas = await cached(
    `dashboard:headcount:${deptId}`,
    [CACHE_TAGS.vas, CACHE_TAGS.assignments, CACHE_TAGS.dashboard],
    60,
    () =>
      prisma.vAProfile.findMany({
        where: { user: { memberships: { some: { departmentId: deptId, endedAt: null } } } },
        select: {
          status: true,
          availabilityStatus: true,
          totalCapacityHours: true,
          assignments: { where: { status: 'ACTIVE' }, select: { id: true } },
          // The current engagement status lives on EmploymentRecord (isCurrent),
          // not VAProfile.engagementStatus — same convention vas/page.tsx uses
          // for its "Engagement Status" column.
          user: { select: { employmentRecords: { where: { isCurrent: true }, take: 1, select: { employmentStatus: true } } } },
        },
      })
  )

  const employedCount = vas.filter((v) => v.user.employmentRecords[0]?.employmentStatus === 'EMPLOYED').length
  const activeVAs = vas.filter((v) => v.status === 'ACTIVE')
  const activeAvailableCount = activeVAs.filter((v) => v.availabilityStatus === 'AVAILABLE').length
  const activeNoClientCount = activeVAs.filter((v) => v.assignments.length === 0).length
  const fullCount = activeVAs.filter((v) => v.availabilityStatus === 'FULLY_ASSIGNED').length

  const availableVAs = activeVAs.filter((v) => v.availabilityStatus === 'AVAILABLE')
  let fullTime = 0
  let partTime8 = 0
  let partTime4 = 0
  for (const v of availableVAs) {
    const capacity = v.totalCapacityHours != null ? Number(v.totalCapacityHours) : FULL_TIME_HOURS
    if (capacity >= FULL_TIME_HOURS) fullTime++
    else if (capacity >= PART_TIME_8HR_FLOOR_HOURS) partTime8++
    else partTime4++
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Headcount
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Employed VAs</dt>
          <dd className="text-right font-semibold">{employedCount}</dd>
          <dt className="text-muted-foreground">Active — Available</dt>
          <dd className="text-right font-semibold">{activeAvailableCount}</dd>
          <dt className="text-muted-foreground">Active — No Client</dt>
          <dd className="text-right font-semibold">{activeNoClientCount}</dd>
          <dt className="text-muted-foreground">Full</dt>
          <dd className="text-right font-semibold">{fullCount}</dd>
        </dl>
        <div className="pt-2 border-t space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Availability</span>
            <span className="font-semibold">{availableVAs.length} total</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Full-time (8hrs)</dt>
            <dd className="text-right">{fullTime}</dd>
            <dt className="text-muted-foreground">Part-time (&lt;8hrs)</dt>
            <dd className="text-right">{partTime8}</dd>
            <dt className="text-muted-foreground">Part-time (&lt;4hrs)</dt>
            <dd className="text-right">{partTime4}</dd>
          </dl>
        </div>
      </CardContent>
    </Card>
  )
}
