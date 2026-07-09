import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Ticket as TicketIcon } from 'lucide-react'
import { format } from 'date-fns'
import { TicketStatusBadge, TicketPriorityBadge } from '@/components/tickets/TicketBadges'
import { TICKET_STAFF_ROLES } from '@/lib/auth'

export default async function TicketsPage() {
  const user = await getCurrentUser()

  const isStaff = !!user && TICKET_STAFF_ROLES.includes(user.systemRole)
  const where: Record<string, unknown> = {}
  if (!isStaff && user) {
    where.OR = [{ createdBy: user.id }, { assignedTo: user.id }]
  }

  const tickets = await cached(`tickets:list:${isStaff ? 'all' : user?.id}`, [CACHE_TAGS.tickets], 15, () =>
    prisma.ticket.findMany({
      where: where as any,
      include: {
        creator: { select: { firstName: true, lastName: true, email: true } },
        assignee: { select: { firstName: true, lastName: true, email: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tickets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Bug reports and support requests
          </p>
        </div>
        <Link href="/tickets/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </Link>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TicketIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 fade-in-stagger">
          {tickets.map((t) => (
            <Link key={t.id} href={`/tickets/${t.id}`}>
              <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="pt-6 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {t.ticketNumber}
                      </span>
                      <p className="text-sm font-semibold truncate">{t.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.creator.firstName || t.creator.email}
                      {t.department ? ` · ${t.department.name}` : ''}
                      {' · '}
                      {format(t.createdAt, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TicketPriorityBadge priority={t.priority} />
                    <TicketStatusBadge status={t.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
