import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarHeart, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { cached, CACHE_TAGS } from '@/lib/cache'

// How far ahead this widget looks — kept short since it's a glance widget,
// not the full Celebrants page.
const UPCOMING_EVENTS_WINDOW_DAYS = 30

// Rolls a recurring (month, day) date into its next occurrence from `from` —
// this year if not yet passed, otherwise next year.
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

type UpcomingEvent = { id: string; name: string; label: string; date: Date; daysUntil: number }

export async function DepartmentCelebrationsCard({ deptId }: { deptId: string }) {
  const [birthdayUsers, anniversaryUsers] = await cached(
    `dashboard:celebrations:${deptId}`,
    [CACHE_TAGS.users, CACHE_TAGS.dashboard],
    60,
    () =>
      Promise.all([
        // select (not include) — this runs over every member of the
        // department, and pulling full VAProfile/UserProfile records per
        // person for a large department produced a >2MB payload that
        // exceeded unstable_cache's per-entry limit, silently defeating the
        // cache on every load.
        prisma.user.findMany({
          where: {
            memberships: { some: { departmentId: deptId, endedAt: null } },
            profile: { birthDate: { not: null }, nonCelebrant: false, birthdayCelebrant: true },
          },
          select: { id: true, firstName: true, lastName: true, profile: { select: { birthDate: true } } },
        }),
        prisma.user.findMany({
          where: { memberships: { some: { departmentId: deptId, endedAt: null } } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userType: true,
            vaProfile: { select: { currentHireDate: true } },
            employmentRecords: { where: { isCurrent: true }, take: 1, select: { startDate: true } },
          },
        }),
      ])
  )

  const now = new Date()
  const events: UpcomingEvent[] = []

  for (const u of birthdayUsers) {
    const birthDate = toValidDate(u.profile?.birthDate)
    if (!birthDate) continue
    const next = nextOccurrence(birthDate.getMonth(), birthDate.getDate(), now)
    const daysUntil = Math.ceil((next.getTime() - now.getTime()) / 86400000)
    if (daysUntil > UPCOMING_EVENTS_WINDOW_DAYS) continue
    events.push({ id: `bday:${u.id}`, name: `${u.firstName} ${u.lastName}`, label: 'Birthday', date: next, daysUntil })
  }

  for (const u of anniversaryUsers) {
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
    events.push({ id: `anniv:${u.id}`, name: `${u.firstName} ${u.lastName}`, label, date: next, daysUntil })
  }

  events.sort((a, b) => a.daysUntil - b.daysUntil)
  const upcoming = events.slice(0, 5)

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarHeart className="h-4 w-4" />
          Upcoming Celebrations
        </CardTitle>
        <Link href="/celebrants" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No upcoming celebrations in the next {UPCOMING_EVENTS_WINDOW_DAYS} days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                <div>
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.label} • {format(e.date, 'MMM d')}
                  </p>
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
