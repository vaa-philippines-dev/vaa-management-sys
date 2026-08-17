import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Ticket as TicketIcon } from 'lucide-react'
import { TerminationPanel } from '@/components/tickets/TerminationPanel'
import { VA_MUTATOR_ROLES, TICKET_VIEW_ALL_ROLES } from '@/lib/auth'
import { canApproveClearanceDepartment } from '@/lib/offboarding-permissions'
import type { ExitClearanceDepartment } from '@/src/generated/prisma/enums'

const ALL_CLEARANCE_DEPARTMENTS: ExitClearanceDepartment[] = [
  'SERVICE_DEPARTMENT',
  'CUSTOMER_SUCCESS',
  'TRAINING',
  'ACCOUNTING',
  'HR',
]

export default async function OffboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const termination = await prisma.termination.findUnique({
    where: { id },
    include: {
      vaProfile: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
      assignment: { select: { client: { select: { name: true } } } },
      ticket: { select: { id: true, ticketNumber: true } },
      exitSurveyInvite: { select: { token: true, completedAt: true, expiresAt: true } },
      clearance: true,
      discussion: true,
      replacementRequest: true,
      clearanceApprovals: {
        include: { approver: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { department: 'asc' },
      },
      complianceReview: true,
      finalPayout: true,
    },
  })

  if (!termination) notFound()

  const canEdit = VA_MUTATOR_ROLES.includes(user.systemRole)

  const approvableDepartments: string[] = []
  if (termination.isVoluntaryResignation) {
    const vaUserId = termination.vaProfile.userId
    const checks = await Promise.all(
      ALL_CLEARANCE_DEPARTMENTS.map((d) => canApproveClearanceDepartment(user, d, vaUserId))
    )
    ALL_CLEARANCE_DEPARTMENTS.forEach((d, i) => {
      if (checks[i]) approvableDepartments.push(d)
    })
  }

  if (!canEdit && approvableDepartments.length === 0 && termination.initiatedById !== user.id) notFound()

  // Tickets are an HR/Admin-only surface (TICKET_VIEW_ALL_ROLES / ownership) —
  // a Team Leader or department approver acting on this case may not be
  // allowed to open it, so only show the link to viewers who actually can.
  const canViewTicket =
    TICKET_VIEW_ALL_ROLES.includes(user.systemRole) ||
    termination.initiatedById === user.id

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/offboarding">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold tracking-tight">
            {`${termination.vaProfile.user.firstName} ${termination.vaProfile.user.lastName}`.trim()}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Offboarding case</p>
        </div>
        {termination.ticket && canViewTicket && (
          <Link href={`/tickets/${termination.ticket.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <TicketIcon className="h-3.5 w-3.5" />
              {termination.ticket.ticketNumber}
            </Button>
          </Link>
        )}
      </div>

      <TerminationPanel
        termination={{
          id: termination.id,
          type: termination.type,
          affectsBothParties: termination.affectsBothParties,
          resultingStatus: termination.resultingStatus,
          workflowStatus: termination.workflowStatus,
          effectiveDate: termination.effectiveDate.toISOString(),
          vaProfileId: termination.vaProfile.id,
          vaName: `${termination.vaProfile.user.firstName} ${termination.vaProfile.user.lastName}`.trim(),
          clientName: termination.assignment?.client.name ?? null,
          exitSurvey: termination.exitSurveyInvite
            ? {
                token: termination.exitSurveyInvite.token,
                completed: !!termination.exitSurveyInvite.completedAt,
                expiresAt: termination.exitSurveyInvite.expiresAt.toISOString(),
              }
            : null,
          clearance: termination.clearance
            ? {
                id: termination.clearance.id,
                equipmentReturned: termination.clearance.equipmentReturned,
                accountsRevoked: termination.clearance.accountsRevoked,
                documentsSubmitted: termination.clearance.documentsSubmitted,
                finalPayCleared: termination.clearance.finalPayCleared,
                outstandingBalanceNote: termination.clearance.outstandingBalanceNote,
              }
            : null,
          isVoluntaryResignation: termination.isVoluntaryResignation,
          assignmentId: termination.assignmentId,
          resignationDocUrl: termination.resignationDocUrl,
          trainingPassedAt: termination.trainingPassedAt?.toISOString() ?? null,
          discussion: termination.discussion
            ? {
                retained: termination.discussion.retained,
                conductedAt: termination.discussion.conductedAt?.toISOString() ?? null,
                lastWorkingDay: termination.discussion.lastWorkingDay?.toISOString() ?? null,
                recordingLink: termination.discussion.recordingLink,
                turnoverDiscussed: termination.discussion.turnoverDiscussed,
              }
            : null,
          replacementRequest: termination.replacementRequest
            ? { pipelineStatus: termination.replacementRequest.pipelineStatus }
            : null,
          clearanceApprovals: termination.clearanceApprovals.map((a) => ({
            id: a.id,
            department: a.department,
            status: a.status,
            comments: a.comments,
            approverName: a.approverName || (a.approver ? a.approver.firstName || a.approver.email : null),
            actionDate: a.actionDate?.toISOString() ?? null,
            token: a.token,
            checklistItems: Array.isArray(a.checklistItems)
              ? (a.checklistItems as { label: string; checked: boolean }[])
              : [],
          })),
          complianceReview: termination.complianceReview
            ? {
                properlyConducted: termination.complianceReview.properlyConducted,
                voluntaryConfirmation: termination.complianceReview.voluntaryConfirmation,
                noticePeriodCommunicated: termination.complianceReview.noticePeriodCommunicated,
                noUnresolvedIssues: termination.complianceReview.noUnresolvedIssues,
                turnoverAcknowledged: termination.complianceReview.turnoverAcknowledged,
                overallResult: termination.complianceReview.overallResult,
              }
            : null,
          finalPayout: termination.finalPayout
            ? {
                amount: termination.finalPayout.amount ? Number(termination.finalPayout.amount) : null,
                endorsedAt: termination.finalPayout.endorsedAt?.toISOString() ?? null,
                slaDueDate: termination.finalPayout.slaDueDate?.toISOString() ?? null,
                processedAt: termination.finalPayout.processedAt?.toISOString() ?? null,
                status: termination.finalPayout.status,
              }
            : null,
        }}
        canEdit={canEdit}
        approvableDepartments={approvableDepartments}
      />
    </div>
  )
}
