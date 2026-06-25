import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Clock } from 'lucide-react'
import { format } from 'date-fns'

export default async function WorkLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string }>
}) {
  const { assignmentId } = await searchParams
  const user = await getCurrentUser()

  const where: Record<string, unknown> = {}
  if (assignmentId) where.assignmentId = assignmentId
  if (user?.role === 'VA') where.vaProfileId = user.vaProfile?.id

  const logs = await prisma.workLog.findMany({
    where,
    include: {
      vaProfile: { include: { user: true } },
      assignment: { include: { client: true } },
    },
    orderBy: { workDate: 'desc' },
    take: 100,
  })

  const total = logs.reduce((s, l) => s + Number(l.hours), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Work Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Daily hour entries recorded by VAs
          </p>
        </div>
        <Link href="/work-logs/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Log Hours
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total hours (visible)</p>
            <p className="text-2xl font-bold">{total.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Entries</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No work logs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-4 hover:bg-accent/20">
                  <div>
                    <p className="text-sm font-medium">
                      {log.assignment.client.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.vaProfile.user.name || log.vaProfile.user.email} •{' '}
                      {format(log.workDate, 'EEE, MMM dd, yyyy')}
                    </p>
                    {log.description && (
                      <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {Number(log.hours).toFixed(1)}h
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}