import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'

export default async function VADetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const va = await prisma.vAProfile.findUnique({
    where: { id },
    include: {
      user: true,
      skills: true,
      assignments: { include: { client: true, workLogs: true } },
    },
  })

  if (!va) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/vas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {va.user.name || va.user.email}
            </h2>
            <Badge variant={va.isActive ? 'default' : 'secondary'}>
              {va.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {va.user.email} • {va.user.department}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phone</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{va.phone ?? '-'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hourly Rate</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {va.hourlyRate ? `$${Number(va.hourlyRate).toFixed(2)}/hr` : '-'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Skills</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{va.skills.length}</CardContent>
        </Card>
      </div>

      {va.skills.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {va.skills.map((s) => (
                <Badge key={s.id} variant="outline">{s.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {va.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No assignments yet.</p>
          ) : (
            <div className="space-y-3">
              {va.assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/assignments/${a.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{a.client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type} • {Number(a.agreedHours)}h agreed • {format(a.startDate, 'MMM dd, yyyy')}
                      {a.endDate && ` → ${format(a.endDate, 'MMM dd, yyyy')}`}
                    </p>
                  </div>
                  <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {a.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {va.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {va.notes}
          </CardContent>
        </Card>
      )}
    </div>
  )
}