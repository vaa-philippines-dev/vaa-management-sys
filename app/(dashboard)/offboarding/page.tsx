import { prisma } from '@/lib/prisma'
import {
  getCurrentUser,
  VA_MUTATOR_ROLES,
  TICKET_VIEW_ALL_ROLES,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
} from '@/lib/auth'
import { canApproveClearanceDepartment } from '@/lib/offboarding-permissions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { UserMinus, Ticket as TicketIcon } from 'lucide-react'
import { OffboardingStatusBadge, OffboardingTypeBadge } from '@/components/offboarding/OffboardingStatusBadge'
import { CopyLinkCard } from '@/components/offboarding/CopyLinkCard'
import type { ExitClearanceDepartment } from '@/src/generated/prisma/enums'

const ALL_CLEARANCE_DEPARTMENTS: ExitClearanceDepartment[] = [
  'SERVICE_DEPARTMENT',
  'CUSTOMER_SUCCESS',
  'TRAINING',
  'ACCOUNTING',
  'HR',
]

export default async function OffboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const canViewAll = VA_MUTATOR_ROLES.includes(user.systemRole)
  const canViewTickets = TICKET_VIEW_ALL_ROLES.includes(user.systemRole)

  // Offboarding is an HR-owned workflow, but a Dept/Ops Manager or Team
  // Leader only owns their own department's people — VA_MUTATOR_ROLES alone
  // was showing every scoped manager every case in the company. Admins and
  // HR stay unscoped (isDepartmentUnrestricted, the same split the rest of
  // the app uses); everyone else in VA_MUTATOR_ROLES is narrowed to the
  // departments they're actually a member of.
  const readUnrestricted = isDepartmentUnrestricted(user)
  const managedIds = getManagedDepartmentIds(user)
  const departmentScope =
    canViewAll && !readUnrestricted
      ? {
          vaProfile: {
            user: { memberships: { some: { departmentId: { in: managedIds }, endedAt: null } } },
          },
        }
      : {}

  let terminations = await prisma.termination.findMany({
    where: departmentScope,
    include: {
      vaProfile: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
      assignment: { select: { client: { select: { name: true } } } },
      ticket: { select: { id: true, ticketNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!canViewAll) {
    const filtered: typeof terminations = []
    for (const t of terminations) {
      if (!t.isVoluntaryResignation) continue
      const checks = await Promise.all(
        ALL_CLEARANCE_DEPARTMENTS.map((d) => canApproveClearanceDepartment(user, d, t.vaProfile.userId))
      )
      if (checks.some(Boolean)) filtered.push(t)
    }
    terminations = filtered
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Offboarding</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {readUnrestricted
            ? 'Termination and resignation cases across the company'
            : 'Termination and resignation cases in your department'}
        </p>
      </div>

      {canViewAll && (
        <CopyLinkCard
          path="/resign"
          title="Resignation Request Link"
          description="Share with team leaders — they sign in with their own Google account"
        />
      )}

      {terminations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UserMinus className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No offboarding cases yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>VA</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminations.map((t) => (
                <TableRow key={t.id} className="cursor-pointer">
                  <TableCell className="p-0">
                    <Link href={`/offboarding/${t.id}`} className="block px-4 py-3 font-medium hover:text-primary">
                      {`${t.vaProfile.user.firstName} ${t.vaProfile.user.lastName}`.trim()}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/offboarding/${t.id}`} className="block">
                      {t.assignment ? `Assignment — ${t.assignment.client.name}` : 'Entire VA'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/offboarding/${t.id}`} className="block">
                      <OffboardingTypeBadge type={t.type} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/offboarding/${t.id}`} className="block">
                      <OffboardingStatusBadge status={t.workflowStatus} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/offboarding/${t.id}`} className="block text-muted-foreground">
                      {format(t.effectiveDate, 'MMM dd, yyyy')}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {t.ticket && canViewTickets ? (
                      <Link
                        href={`/tickets/${t.ticket.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                      >
                        <TicketIcon className="h-3 w-3" />
                        {t.ticket.ticketNumber}
                      </Link>
                    ) : t.ticket ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <TicketIcon className="h-3 w-3" />
                        {t.ticket.ticketNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
