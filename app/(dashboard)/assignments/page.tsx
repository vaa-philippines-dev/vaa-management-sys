import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Briefcase } from 'lucide-react'
import { format } from 'date-fns'
import { AssignmentsBoard } from '@/components/assignments/AssignmentsBoard'
import type { AssignmentRow } from '@/components/assignments/AssignmentCard'

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

  const sumHours = (logs: { hours: any }[]) => logs.reduce((s, l) => s + Number(l.hours), 0)

  const toRow = (a: typeof assignments[number]): AssignmentRow => ({
    id: a.id,
    clientName: a.client.name,
    vaName: a.vaProfile.user.firstName || a.vaProfile.user.email,
    status: a.status,
    agreedHours: Number(a.agreedHours),
    loggedHours: sumHours(a.workLogs),
    startLabel: format(a.startDate, 'MMM dd, yyyy'),
    endLabel: a.endDate ? format(a.endDate, 'MMM dd, yyyy') : null,
  })

  const regular = assignments.filter((a) => a.type === 'REGULAR').map(toRow)
  const projects = assignments.filter((a) => a.type === 'PROJECT').map(toRow)

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
        <AssignmentsBoard regular={regular} projects={projects} />
      )}
    </div>
  )
}
