import { prisma } from '@/lib/prisma'
import { getCurrentUser, getManagedDepartmentIds } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PartyPopper } from 'lucide-react'

const FULL_ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

// Days until the next occurrence of this month/day, counting today as 0.
function daysUntilNext(date: Date, today: Date) {
  const next = new Date(today.getFullYear(), date.getMonth(), date.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

export default async function AnniversaryPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const isFullAdmin = FULL_ADMIN_ROLES.includes(user.systemRole)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'

  let scopedDeptIds: string[] | undefined
  if (!isFullAdmin) {
    scopedDeptIds = isVA
      ? (user.memberships ?? []).filter((m) => !m.endedAt).map((m) => m.departmentId)
      : getManagedDepartmentIds(user)
  }

  const users = await prisma.user.findMany({
    where: scopedDeptIds ? { memberships: { some: { departmentId: { in: scopedDeptIds }, endedAt: null } } } : undefined,
    include: {
      vaProfile: true,
      // Current staff-era record (isCurrent: true) is the authoritative "Staff Anniversary"
      // source once promoted; historical VA-era records stay queryable but are not
      // treated as "the" active anniversary for a promoted user.
      employmentRecords: { orderBy: { startDate: 'desc' } },
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  type Row = {
    id: string
    name: string
    label: 'VA Anniversary' | 'Staff Anniversary'
    currentDate: Date
    daysUntil: number
    history: { label: string; date: Date }[]
  }

  const rows: Row[] = []

  for (const u of users) {
    const currentEmploymentRecord = u.employmentRecords.find((er) => er.isCurrent)
    const history: { label: string; date: Date }[] = []

    let label: Row['label'] | null = null
    let currentDate: Date | null = null

    if (u.userType === 'VIRTUAL_ASSISTANT' && u.vaProfile?.currentHireDate) {
      label = 'VA Anniversary'
      currentDate = u.vaProfile.currentHireDate
    } else if (u.userType === 'INTERNAL_STAFF' && currentEmploymentRecord) {
      label = 'Staff Anniversary'
      currentDate = currentEmploymentRecord.startDate
      // Preserve the VA-era hire date as historical context — it must remain
      // visible but must not be treated as the active anniversary once promoted.
      if (u.vaProfile?.currentHireDate) {
        history.push({ label: 'VA Anniversary (previous)', date: u.vaProfile.currentHireDate })
      }
    }

    // Any non-current employment records are additional history, regardless of userType.
    for (const er of u.employmentRecords) {
      if (!er.isCurrent) {
        history.push({ label: 'Prior employment record', date: er.startDate })
      }
    }

    if (label && currentDate) {
      rows.push({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        label,
        currentDate,
        daysUntil: daysUntilNext(currentDate, today),
        history,
      })
    }
  }

  rows.sort((a, b) => a.daysUntil - b.daysUntil)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Anniversary</h2>
        <p className="text-sm text-muted-foreground mt-1">
          VA and Staff work anniversaries — promoted VAs show their current Staff Anniversary, with the prior VA Anniversary kept visible as history
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PartyPopper className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No anniversaries found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden divide-y">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{r.label}</Badge>
                  <Badge variant="outline" className="text-xs">{formatMonthDay(r.currentDate)}</Badge>
                  {r.daysUntil === 0 && <Badge className="text-xs">Today</Badge>}
                </div>
              </div>
              {r.history.length > 0 && (
                <div className="pl-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {r.history.map((h, i) => (
                    <span key={i}>
                      previously: {h.label} since {formatMonthDay(h.date)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
