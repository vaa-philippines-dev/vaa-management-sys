import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { TicketStatusBadge, TicketPriorityBadge } from '@/components/tickets/TicketBadges'
import { TicketStatusButtons } from '@/components/tickets/TicketStatusButtons'
import { TicketAssigneeSelect } from '@/components/tickets/TicketAssigneeSelect'
import { TicketConversation } from '@/components/tickets/TicketConversation'
import { TICKET_VIEW_ALL_ROLES, TICKET_MUTATOR_ROLES } from '@/lib/auth'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      creator: { select: { firstName: true, lastName: true, email: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      department: { select: { name: true } },
      client: { select: { name: true } },
      conversations: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
  })

  if (!ticket) notFound()

  const canViewAll = TICKET_VIEW_ALL_ROLES.includes(user.systemRole)
  const canMutate = TICKET_MUTATOR_ROLES.includes(user.systemRole)
  const isOwner = ticket.createdBy === user.id || ticket.assignedTo === user.id
  if (!canViewAll && !isOwner) notFound()

  const visibleMessages = canViewAll
    ? ticket.conversations
    : ticket.conversations.filter((m) => !m.isInternalNote)

  const assignableUsers = canMutate
    ? await prisma.user.findMany({
        where: { systemRole: { in: TICKET_MUTATOR_ROLES as any } },
        select: { id: true, firstName: true, email: true },
        orderBy: { firstName: 'asc' },
      })
    : []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tickets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1">{ticket.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reported by {ticket.creator.firstName || ticket.creator.email}
            {ticket.department ? ` · ${ticket.department.name}` : ''}
            {ticket.client ? ` · ${ticket.client.name}` : ''}
            {' · '}
            {format(ticket.createdAt, 'MMM dd, yyyy')}
          </p>
        </div>
        {canMutate && <TicketStatusButtons id={ticket.id} current={ticket.status} />}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
              {ticket.description || 'No description provided.'}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketConversation
                ticketId={ticket.id}
                messages={visibleMessages}
                canWriteInternalNotes={canMutate}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <p className="font-medium">{ticket.category.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Source</p>
                <p className="font-medium">{ticket.source.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assignee</p>
                {canMutate ? (
                  <TicketAssigneeSelect
                    ticketId={ticket.id}
                    currentAssigneeId={ticket.assignee?.id ?? null}
                    staff={assignableUsers.map((s) => ({ id: s.id, label: s.firstName || s.email }))}
                  />
                ) : (
                  <p className="font-medium">
                    {ticket.assignee ? ticket.assignee.firstName || ticket.assignee.email : 'Unassigned'}
                  </p>
                )}
              </div>
              {ticket.resolvedAt && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resolved</p>
                  <p className="font-medium">{format(ticket.resolvedAt, 'MMM dd, yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
