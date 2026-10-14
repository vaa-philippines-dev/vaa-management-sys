import { prisma } from '@/lib/prisma'
import { getCurrentUser, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { getViewScope, isDepartmentInScope, isUserInScope } from '@/lib/scope'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { AssignmentStatusButtons, AssignmentStatusActionButton } from '@/components/assignments/AssignmentStatusButtons'
import { AssignmentEditButton } from '@/components/assignments/AssignmentEditButton'
import { AdditionalHoursButton } from '@/components/assignments/AdditionalHoursButton'
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_REASON_LABELS,
} from '@/lib/assignment-status-fields'

// Status dates are stored as UTC midnight — format in UTC so they don't
// shift a day on a server in another timezone.
function formatUtcDate(d: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d)
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      client: true,
      vaProfile: { include: { user: true, vaSkills: { include: { skill: true } } } },
      workLogs: { orderBy: { workDate: 'desc' } },
      statusEvents: {
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        include: { actor: { select: { firstName: true, lastName: true } } },
      },
      parentAssignment: {
        select: {
          id: true,
          agreedHours: true,
          status: true,
          startDate: true,
          additionalHours: { select: { id: true, agreedHours: true, status: true } },
        },
      },
      additionalHours: {
        select: { id: true, agreedHours: true, status: true, startDate: true, notes: true },
        orderBy: { startDate: 'desc' },
      },
    },
  })

  if (!assignment) notFound()

  if (user?.userType === 'VIRTUAL_ASSISTANT' && assignment.vaProfileId !== user.vaProfile?.id) {
    notFound()
  }

  // Staff: the assignment belongs to its client's department, not the VA's —
  // 404 rather than 403 so out-of-scope ids don't confirm they exist.
  if (user.userType !== 'VIRTUAL_ASSISTANT') {
    const scope = await getViewScope(user)
    if (!isDepartmentInScope(scope, assignment.client.departmentId)) notFound()
    if (!isUserInScope(scope, assignment.vaProfile.userId)) notFound()
  }

  const totalLogged = assignment.workLogs.reduce((s, l) => s + Number(l.hours), 0)

  // The whole engagement = the root assignment plus its additional-hours
  // add-ons. Only ACTIVE rows count toward current hours, same as VA
  // Availability.
  const root = assignment.parentAssignment ?? assignment
  const engagementRows = [root, ...root.additionalHours]
  const engagementHours = engagementRows
    .filter((a) => a.status === 'ACTIVE')
    .reduce((s, a) => s + Number(a.agreedHours), 0)
  const hasAddOns = root.additionalHours.length > 0
  const canMutate = ASSIGNMENT_MUTATOR_ROLES.includes(user.systemRole) && assignment.source !== 'VA_CONNECTIONS_SYNC'
  const canAddHours = canMutate && (root.status === 'ACTIVE' || root.status === 'PAUSED')
  const vaName = assignment.vaProfile.user.firstName || assignment.vaProfile.user.email

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/assignments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{assignment.client.name}</h2>
            <Badge variant={assignment.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {assignment.status}
            </Badge>
            <Badge variant="outline">{assignment.type}</Badge>
            {assignment.parentAssignment && <Badge variant="outline">Additional Hours</Badge>}
            {assignment.source === 'VA_CONNECTIONS_SYNC' && (
              <Badge variant="outline">Synced from VAConnections</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Assigned to {vaName}
          </p>
          {assignment.parentAssignment && (
            <p className="text-xs text-muted-foreground mt-1">
              Adds to the{' '}
              <Link href={`/assignments/${assignment.parentAssignment.id}`} className="underline hover:text-primary">
                {Number(assignment.parentAssignment.agreedHours)}h engagement from{' '}
                {format(assignment.parentAssignment.startDate, 'MMM dd, yyyy')}
              </Link>
            </p>
          )}
          {assignment.source === 'VA_CONNECTIONS_SYNC' && (
            <p className="text-xs text-muted-foreground mt-1">
              Managed by the VAConnections sheet — edit there, changes sync in automatically.
            </p>
          )}
        </div>
        {canMutate && (
          <div className="flex items-center gap-2">
            {canAddHours && (
              <AdditionalHoursButton
                assignmentId={root.id}
                clientName={assignment.client.name}
                vaName={vaName}
                type={assignment.type}
                currentHours={engagementHours}
              />
            )}
            <AssignmentEditButton
              assignment={{
                id: assignment.id,
                clientName: assignment.client.name,
                vaName,
                type: assignment.type,
                agreedHours: Number(assignment.agreedHours),
                monthlyHours: assignment.monthlyHours ? Number(assignment.monthlyHours) : null,
                startDate: assignment.startDate.toISOString(),
                endDate: assignment.endDate?.toISOString() ?? null,
                notes: assignment.notes,
              }}
            />
            <AssignmentStatusButtons id={assignment.id} current={assignment.status} />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agreed Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Number(assignment.agreedHours)}h</p>
            {hasAddOns && (
              <p className="text-xs text-muted-foreground mt-1">{engagementHours}h active across the engagement</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Logged Hours</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{totalLogged.toFixed(1)}h</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {format(assignment.startDate, 'MMM dd, yyyy')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {assignment.endDate ? (assignment.status === 'CANCELLED' ? 'Cancelled On' : 'End Date') : 'Ongoing'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {assignment.endDate ? format(assignment.endDate, 'MMM dd, yyyy') : '—'}
          </CardContent>
        </Card>
      </div>

      {!assignment.parentAssignment && hasAddOns && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignment.additionalHours.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/assignments/${a.id}`} className="text-sm font-medium hover:text-primary">
                        +{Number(a.agreedHours)}h from {format(a.startDate, 'MMM dd, yyyy')}
                      </Link>
                      <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">
                        {a.status}
                      </Badge>
                    </div>
                    {a.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.notes}</p>}
                  </div>
                  {canMutate && (a.status === 'ACTIVE' || a.status === 'PAUSED') && (
                    <AssignmentStatusActionButton
                      assignmentId={a.id}
                      target="CANCELLED"
                      label="Cancel request"
                      title="Cancel additional hours"
                      className="text-muted-foreground"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {assignment.statusEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignment.statusEvents.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {ASSIGNMENT_STATUS_LABELS[e.fromStatus]} &rarr; {ASSIGNMENT_STATUS_LABELS[e.toStatus]}
                      {e.reason && (
                        <span className="font-normal text-muted-foreground"> · {ASSIGNMENT_STATUS_REASON_LABELS[e.reason]}</span>
                      )}
                    </p>
                    {e.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.note}</p>}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {e.actor ? `${e.actor.firstName} ${e.actor.lastName}`.trim() : 'System'} · recorded{' '}
                      {format(e.createdAt, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {formatUtcDate(e.effectiveDate)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Work Logs</CardTitle>
          {ASSIGNMENT_MUTATOR_ROLES.includes(user.systemRole) && (
            <Link href={`/work-logs/new?assignmentId=${assignment.id}`}>
              <Button size="sm">Log Hours</Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {assignment.workLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No work logs yet.</p>
          ) : (
            <div className="space-y-2">
              {assignment.workLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{format(log.workDate, 'EEE, MMM dd, yyyy')}</p>
                    {log.description && (
                      <p className="text-xs text-muted-foreground mt-1">{log.description}</p>
                    )}
                  </div>
                  <Badge variant="outline">{Number(log.hours).toFixed(1)}h</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {assignment.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {assignment.notes}
          </CardContent>
        </Card>
      )}
    </div>
  )
}