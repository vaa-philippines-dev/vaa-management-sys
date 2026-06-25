import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { AssignmentStatusButtons } from '@/components/assignments/AssignmentStatusButtons'

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      client: true,
      vaProfile: { include: { user: true, skills: true } },
      workLogs: { orderBy: { workDate: 'desc' } },
    },
  })

  if (!assignment) notFound()

  if (user?.role === 'VA' && assignment.vaProfileId !== user.vaProfile?.id) {
    notFound()
  }

  const totalLogged = assignment.workLogs.reduce((s, l) => s + Number(l.hours), 0)

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
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Assigned to {assignment.vaProfile.user.name || assignment.vaProfile.user.email}
          </p>
        </div>
        {user?.role === 'MANAGER' && <AssignmentStatusButtons id={assignment.id} current={assignment.status} />}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agreed Hours</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{Number(assignment.agreedHours)}h</CardContent>
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
              {assignment.endDate ? 'End Date' : 'Ongoing'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {assignment.endDate ? format(assignment.endDate, 'MMM dd, yyyy') : '—'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Work Logs</CardTitle>
          {user?.role === 'MANAGER' && (
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