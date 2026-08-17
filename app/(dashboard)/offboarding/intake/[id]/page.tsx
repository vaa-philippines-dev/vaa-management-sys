import { prisma } from '@/lib/prisma'
import { getCurrentUser, VA_MUTATOR_ROLES, TICKET_VIEW_ALL_ROLES } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Ticket as TicketIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IntakeReviewForm } from '@/components/offboarding/IntakeReviewForm'

export default async function ResignationIntakeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!VA_MUTATOR_ROLES.includes(user.systemRole)) notFound()

  const intake = await prisma.resignationIntake.findUnique({
    where: { id },
    include: {
      ticket: { select: { id: true, ticketNumber: true } },
      department: { select: { name: true } },
    },
  })
  if (!intake) notFound()

  const vaOptions = await prisma.vAProfile.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, user: { select: { firstName: true, lastName: true, employeeId: true } } },
    orderBy: { user: { firstName: 'asc' } },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/offboarding">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold tracking-tight">Resignation Request</h2>
          <p className="text-sm text-muted-foreground mt-1">Submitted via the public form — match it to a real VA to continue</p>
        </div>
        {TICKET_VIEW_ALL_ROLES.includes(user.systemRole) && (
          <Link href={`/tickets/${intake.ticket.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <TicketIcon className="h-3.5 w-3.5" />
              {intake.ticket.ticketNumber}
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Submission Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reported by</p>
            <p className="font-medium">{intake.teamLeaderName} · {intake.teamLeaderEmail}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">VA (as typed)</p>
            <p className="font-medium">{intake.vaIdentifier}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Department</p>
            <p className="font-medium">{intake.department?.name ?? '—'}</p>
          </div>
          {intake.reason && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="font-medium whitespace-pre-wrap">{intake.reason}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Submitted</p>
            <p className="font-medium">{format(intake.createdAt, 'MMM dd, yyyy h:mm a')}</p>
          </div>
        </CardContent>
      </Card>

      {intake.status !== 'PENDING_REVIEW' ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            This request has already been {intake.status === 'CONVERTED' ? 'converted' : 'dismissed'}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Confirm the VA</CardTitle>
          </CardHeader>
          <CardContent>
            <IntakeReviewForm
              intakeId={intake.id}
              vaOptions={vaOptions.map((v) => ({
                userId: v.id,
                name: `${v.user.firstName} ${v.user.lastName}`.trim() + (v.user.employeeId ? ` (${v.user.employeeId})` : ''),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
