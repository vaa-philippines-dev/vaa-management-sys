import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Briefcase } from 'lucide-react'
import { format } from 'date-fns'

export default async function AssignmentsPage() {
  const user = await getCurrentUser()

  const where: Record<string, unknown> = {}
  if (user?.userType === 'VIRTUAL_ASSISTANT') where.vaProfileId = user.vaProfile?.id

  const assignments = await cached('assignments:list', [CACHE_TAGS.assignments], 30, () =>
    prisma.assignment.findMany({
      where: where as any,
      include: {
        client: true,
        vaProfile: { include: { user: true, vaSkills: { include: { skill: true } } } },
        workLogs: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
  )

  const regular = assignments.filter((a) => a.type === 'REGULAR')
  const projects = assignments.filter((a) => a.type === 'PROJECT')

  const sumHours = (logs: { hours: any }[]) => logs.reduce((s, l) => s + Number(l.hours), 0)

  const renderCard = (a: typeof assignments[number]) => (
    <Link key={a.id} href={`/assignments/${a.id}`}>
      <Card className={`cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 ${a.status === 'ACTIVE' ? 'border-l-green-500' : 'border-l-muted-foreground/30'}`}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold">{a.client.name}</p>
              <p className="text-xs text-muted-foreground">
                {a.vaProfile.user.firstName || a.vaProfile.user.email}
              </p>
            </div>
            <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'} className="shrink-0">
              {a.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div>
              <p className="text-muted-foreground">Agreed</p>
              <p className="font-medium">{Number(a.agreedHours)}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Logged</p>
              <p className="font-medium">{sumHours(a.workLogs).toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Start</p>
              <p className="font-medium">{format(a.startDate, 'MMM dd, yyyy')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{a.endDate ? 'End' : 'Ongoing'}</p>
              <p className="font-medium">{a.endDate ? format(a.endDate, 'MMM dd, yyyy') : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assignments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Match VAs to clients based on skills
          </p>
        </div>
        <Link href="/assignments/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Assignment
          </Button>
        </Link>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Regular ({regular.length})
            </h3>
            {regular.length === 0 ? (
              <p className="text-xs text-muted-foreground">No regular assignments.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger">
                {regular.map(renderCard)}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Projects ({projects.length})
            </h3>
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No project assignments.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger">
                {projects.map(renderCard)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
