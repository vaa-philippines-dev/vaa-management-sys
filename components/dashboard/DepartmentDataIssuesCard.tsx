import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { getPreparationsMissingEffectivityDate } from '@/lib/va-preparation'
import Link from 'next/link'

// Mirrors the DMF sheet's "MISSING / INCOMPLETE / INCORRECT DATA" panel.
// All three of the sheet's rules are live now: the first two read off
// VAProfile, and the third ("VA Preparation Missing EOC/Pause Dates") reads
// AssignmentPreparation rows parked as Paused/End of Work with no
// effectivity date — see lib/va-preparation.ts.
const TERMINAL_STATUSES = ['TRANSFERRED', 'RESIGNED', 'REMOVED', 'PROJECT_ENDED', 'CANCELLED'] as const

export async function DepartmentDataIssuesCard({ deptId }: { deptId: string }) {
  const missingEffectivity = await cached(
    `dashboard:prepMissingEffectivity:${deptId}`,
    [CACHE_TAGS.assignments, CACHE_TAGS.dashboard],
    60,
    () => getPreparationsMissingEffectivityDate(deptId)
  )

  const [noEocDateVAs, toRemoveVAs] = await cached(
    `dashboard:dataIssues:${deptId}`,
    [CACHE_TAGS.vas, CACHE_TAGS.dashboard],
    60,
    () =>
      Promise.all([
        // A VA whose status already reflects an exit (transferred/resigned/
        // removed/etc.) but has no currentEndDate recorded — the exact
        // "NO EOC/TRANSFER DATE" check the sheet runs.
        prisma.vAProfile.findMany({
          where: {
            user: { memberships: { some: { departmentId: deptId, endedAt: null } } },
            status: { in: [...TERMINAL_STATUSES] },
            currentEndDate: null,
          },
          select: { id: true, user: { select: { firstName: true, lastName: true } } },
        }),
        // Engagement says resigned/terminated but the VA record hasn't been
        // moved to REMOVED yet — the sheet's "TO REMOVE / RESIGNED" check.
        prisma.vAProfile.findMany({
          where: {
            user: { memberships: { some: { departmentId: deptId, endedAt: null } } },
            status: { not: 'REMOVED' },
            engagementStatus: { in: ['RESIGNED', 'TERMINATED'] },
          },
          select: { id: true, user: { select: { firstName: true, lastName: true } } },
        }),
      ])
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Missing / Incomplete / Incorrect Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <IssueSection title="No EOC/Transfer Date" people={noEocDateVAs} />
        <IssueSection title="To Remove / Resigned" people={toRemoveVAs} />
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            VA Preparation — Missing EOC/Pause Dates
          </p>
          {missingEffectivity.length === 0 ? (
            <p className="text-xs text-success flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All dates are updated.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {missingEffectivity.map((p) => (
                <Link
                  key={p.id}
                  href="/va-preparation"
                  className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20"
                  title={`${p.clientName} — ${p.clientStatus === 'PAUSED' ? 'Paused' : 'End of Work'} with no effectivity date`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function IssueSection({ title, people }: { title: string; people: { id: string; user: { firstName: string; lastName: string } }[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
      {people.length === 0 ? (
        <p className="text-xs text-success flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All dates are updated.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {people.map((p) => (
            <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
              {p.user.firstName} {p.user.lastName}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
