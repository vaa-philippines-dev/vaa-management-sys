import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Briefcase } from 'lucide-react'
import { format } from 'date-fns'
import { ClientDetailPanel } from '@/components/clients/ClientDetailPanel'
import { CLIENT_PLATFORM_META, CLIENT_STATUS_DOT, CLIENT_STATUS_LABEL } from '@/lib/clients/display'

const CLIENT_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF']

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !CLIENT_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const { id } = await params
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          vaProfile: { include: { user: true } },
          workLogs: true,
        },
      },
    },
  })

  if (!client) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{client.name}</h2>
            <Badge variant={client.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {client.onHold ? 'On Hold' : (CLIENT_STATUS_LABEL[client.status] ?? client.status)}
            </Badge>
            <Badge
              variant="outline"
              className={CLIENT_PLATFORM_META[client.platform]?.color ?? ''}
            >
              {CLIENT_PLATFORM_META[client.platform]?.label ?? client.platform}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {client.contactName && `${client.contactName} • `}
            {client.industry}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          {client.requiredSkills.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Required Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {client.requiredSkills.map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Assignments</CardTitle>
              <Link href={`/assignments/new?clientId=${client.id}`}>
                <Button size="sm">Assign VA</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {client.assignments.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Briefcase className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No assignments yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {client.assignments.map((a) => (
                    <Link
                      key={a.id}
                      href={`/assignments/${a.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {a.vaProfile.user.firstName || a.vaProfile.user.email}
                        </p>
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

          {client.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes}
              </CardContent>
            </Card>
          )}
        </div>

        <ClientDetailPanel
          statusLabel={client.onHold ? 'On Hold' : (CLIENT_STATUS_LABEL[client.status] ?? client.status)}
          statusDotClassName={client.onHold ? 'bg-warning' : (CLIENT_STATUS_DOT[client.status] ?? 'bg-muted-foreground')}
          contactName={client.contactName ?? null}
          contactEmail={client.contactEmail ?? null}
          industry={client.industry ?? null}
          activeAssignments={client.assignments.filter((a) => a.status === 'ACTIVE').length}
        />
      </div>
    </div>
  )
}