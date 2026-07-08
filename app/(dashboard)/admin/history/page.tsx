import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { History } from 'lucide-react'

const EVENT_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Active Status',
  ENGAGEMENT_CHANGE: 'Engagement Status',
  UPSKILL: 'Upskill',
  RATE_CHANGE: 'Rate Change',
  PROMOTION: 'Promotion',
  DEPARTMENT_TRANSFER: 'Department Transfer',
}

const EVENT_COLORS: Record<string, string> = {
  STATUS_CHANGE: 'bg-warning/10 text-warning border-warning/20',
  ENGAGEMENT_CHANGE: 'bg-info/10 text-info border-info/20',
  UPSKILL: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  RATE_CHANGE: 'bg-success/10 text-success border-success/20',
  PROMOTION: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  DEPARTMENT_TRANSFER: 'bg-warning/10 text-warning border-warning/20',
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const eventType = typeof params.eventType === 'string' ? params.eventType : undefined
  const departmentId = typeof params.departmentId === 'string' ? params.departmentId : undefined

  const where: Record<string, unknown> = {}
  if (eventType) where.eventType = eventType
  if (departmentId) where.departmentId = departmentId
  if (q) {
    where.user = {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    }
  }

  const [events, totalCount, departments] = await Promise.all([
    prisma.vAHistory.findMany({
      where,
      orderBy: { effectiveDate: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, userType: true } },
        changedBy: { select: { firstName: true, lastName: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.vAHistory.count(),
    prisma.department.findMany({ where: { status: 'ACTIVE', parentId: { not: null } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-bold tracking-tight">History</h2>
            <p className="text-xs text-muted-foreground">
              {totalCount} event{totalCount !== 1 ? 's' : ''} recorded · showing latest {Math.min(events.length, 100)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
          <FilterBar
            filters={[
              {
                key: 'eventType',
                label: 'Event',
                options: Object.entries(EVENT_LABELS).map(([value, label]) => ({ value, label })),
              },
              {
                key: 'departmentId',
                label: 'Department',
                options: departments.map((d) => ({ value: d.id, label: d.name })),
              },
            ]}
            searchPlaceholder="Search name or email..."
          />
        </Suspense>
      </div>

      <Card>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No history events found.</p>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {(ev.user.firstName || ev.user.email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">
                        {ev.user.firstName} {ev.user.lastName}
                      </span>
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${EVENT_COLORS[ev.eventType] ?? ''}`}>
                        {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {ev.user.userType === 'VIRTUAL_ASSISTANT' ? 'VA' : 'Staff'}
                      </Badge>
                      {ev.department && (
                        <span className="text-[10px] text-muted-foreground">{ev.department.name}</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5">
                      {ev.oldValue ? `${ev.oldValue.replace(/_/g, ' ')} → ` : ''}
                      <span className="font-medium">{(ev.newValue ?? '—').replace(/_/g, ' ')}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      by {ev.changedBy.firstName} {ev.changedBy.lastName}
                      {ev.reason ? ` — ${ev.reason}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(ev.effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
