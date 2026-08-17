'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import {
  logDiscussionOutcome,
  submitResignationLetter,
  updateReplacementRequest,
  logCustomerNotification,
  initiateExitClearance,
  submitComplianceReview,
  recordFinalPayout,
  markTrainingPassed,
  withdrawResignation,
} from '@/app/(dashboard)/vas/actions'

const WITHDRAWABLE_STATUSES = new Set(['INITIATED', 'PENDING_LETTER', 'UNDER_DOCUMENTATION', 'EXIT_SURVEY_PENDING'])
import { ResignationClearanceBoard } from '@/components/tickets/ResignationClearanceBoard'
import { REPLACEMENT_PIPELINE_LABELS, EXIT_CLEARANCE_DEPARTMENT_LABELS } from '@/lib/offboarding'

export type ResignationData = {
  id: string
  vaProfileId: string
  workflowStatus: string
  isVoluntaryResignation: boolean
  assignmentId: string | null
  resignationDocUrl: string | null
  trainingPassedAt: string | null
  exitSurvey: { token: string; completed: boolean; expiresAt: string } | null
  discussion: {
    retained: boolean | null
    conductedAt: string | null
    lastWorkingDay: string | null
    recordingLink: string | null
    turnoverDiscussed: boolean
  } | null
  replacementRequest: { pipelineStatus: string } | null
  clearanceApprovals: {
    id: string
    department: string
    status: string
    comments: string | null
    approverName: string | null
    actionDate: string | null
    token: string | null
    checklistItems: { label: string; checked: boolean }[]
  }[]
  complianceReview: {
    properlyConducted: boolean
    voluntaryConfirmation: boolean
    noticePeriodCommunicated: boolean
    noUnresolvedIssues: boolean
    turnoverAcknowledged: boolean
    overallResult: string | null
  } | null
  finalPayout: {
    amount: number | null
    endorsedAt: string | null
    slaDueDate: string | null
    processedAt: string | null
    status: string
  } | null
}

const COMPLIANCE_ITEMS: { key: keyof NonNullable<ResignationData['complianceReview']> & string; label: string }[] = [
  { key: 'properlyConducted', label: 'Process properly conducted' },
  { key: 'voluntaryConfirmation', label: 'VA voluntarily confirmed the decision' },
  { key: 'noticePeriodCommunicated', label: 'Notice period / last working day clearly communicated' },
  { key: 'noUnresolvedIssues', label: 'No unresolved issues remain' },
  { key: 'turnoverAcknowledged', label: 'Turnover commitments acknowledged' },
]

// The resignation-specific sections layered onto TerminationPanel — only
// rendered when termination.isVoluntaryResignation. Each section is gated
// on the current workflowStatus, matching the SOP's enforced sequence.
export function ResignationSections({
  termination,
  canEdit,
  approvableDepartments,
}: {
  termination: ResignationData
  canEdit: boolean
  approvableDepartments: string[]
}) {
  return (
    <div className="space-y-4">
      <WithdrawSection termination={termination} canEdit={canEdit} />
      <DiscussionSection termination={termination} canEdit={canEdit} />
      <LetterSection termination={termination} canEdit={canEdit} />
      <ReplacementSection termination={termination} canEdit={canEdit} />
      <CustomerNotificationSection termination={termination} canEdit={canEdit} />
      <ExitClearanceSection termination={termination} canEdit={canEdit} approvableDepartments={approvableDepartments} />
      <ComplianceReviewSection termination={termination} canEdit={canEdit} />
      <FinalPayoutSection termination={termination} canEdit={canEdit} />
      <TrainingSection termination={termination} canEdit={canEdit} />
    </div>
  )
}

function WithdrawSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  if (!canEdit || !WITHDRAWABLE_STATUSES.has(termination.workflowStatus)) return null

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted-foreground hover:underline">
        Withdraw this resignation
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-dashed p-2.5 space-y-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for withdrawal"
        disabled={isPending}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !reason}
          onClick={() => {
            const fd = new FormData()
            fd.set('reason', reason)
            startTransition(() => withdrawResignation(termination.id, fd))
          }}
        >
          Confirm Withdraw
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-2 border-t">
      <p className="text-xs text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  )
}

function DiscussionSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition()
  if (termination.discussion) {
    return (
      <Section title="Discussion & Retention">
        <p className="text-xs">
          Retained: <span className="font-medium">{termination.discussion.retained ? 'Yes' : 'No'}</span>
          {termination.discussion.lastWorkingDay && (
            <> · Last Working Day: {format(new Date(termination.discussion.lastWorkingDay), 'MMM dd, yyyy')}</>
          )}
        </p>
        {termination.discussion.recordingLink && (
          <a href={termination.discussion.recordingLink} className="text-xs text-primary hover:underline">
            Recording
          </a>
        )}
      </Section>
    )
  }
  if (termination.workflowStatus !== 'INITIATED' || !canEdit) return null

  return (
    <Section title="Discussion & Retention">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          startTransition(() => logDiscussionOutcome(termination.id, fd))
        }}
      >
        <div className="flex gap-2">
          <select name="retained" required disabled={isPending} className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs flex-1">
            <option value="">Retained?</option>
            <option value="true">Yes — retained</option>
            <option value="false">No — proceeding</option>
          </select>
        </div>
        <Input type="date" name="lastWorkingDay" placeholder="Last working day (defaults to +30 working days)" className="h-8 text-xs" disabled={isPending} />
        <Input name="lwdOverrideReason" placeholder="LWD override reason (if under 2-week minimum)" className="h-8 text-xs" disabled={isPending} />
        <Input name="recordingLink" placeholder="Discussion recording link" className="h-8 text-xs" disabled={isPending} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="turnoverDiscussed" value="true" disabled={isPending} />
          Turnover requirements discussed
        </label>
        <Button type="submit" size="sm" disabled={isPending}>
          Save Outcome
        </Button>
      </form>
    </Section>
  )
}

function LetterSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition()
  if (termination.workflowStatus === 'INITIATED' || termination.workflowStatus === 'CANCELLED') return null

  if (termination.resignationDocUrl || termination.workflowStatus !== 'PENDING_LETTER') {
    if (termination.workflowStatus === 'PENDING_LETTER') return null
    return (
      <Section title="Resignation Letter">
        {termination.resignationDocUrl ? (
          <a href={termination.resignationDocUrl} className="text-xs text-primary hover:underline">
            Attachment
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">Submitted.</p>
        )}
      </Section>
    )
  }

  if (!canEdit) return <Section title="Resignation Letter"><p className="text-xs text-muted-foreground">Awaiting the formal resignation letter.</p></Section>

  return (
    <Section title="Resignation Letter">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          startTransition(() => submitResignationLetter(termination.id, fd))
        }}
      >
        <Input name="customerName" placeholder="Customer name" required disabled={isPending} className="h-8 text-xs" />
        <Input type="date" name="effectiveDate" required disabled={isPending} className="h-8 text-xs" />
        <Input name="attachmentUrl" placeholder="Attachment URL (optional)" disabled={isPending} className="h-8 text-xs" />
        <Button type="submit" size="sm" disabled={isPending}>
          Submit Letter
        </Button>
      </form>
    </Section>
  )
}

function ReplacementSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition()
  if (!termination.replacementRequest) return null

  const done = ['APPROVED', 'NOT_APPLICABLE'].includes(termination.replacementRequest.pipelineStatus)
  return (
    <Section title="Replacement (Service Department)">
      <p className="text-xs mb-2">
        Status: <span className="font-medium">{REPLACEMENT_PIPELINE_LABELS[termination.replacementRequest.pipelineStatus] ?? termination.replacementRequest.pipelineStatus}</span>
      </p>
      {!done && termination.workflowStatus === 'UNDER_DOCUMENTATION' && canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            startTransition(() => updateReplacementRequest(termination.id, fd))
          }}
        >
          <select name="pipelineStatus" required disabled={isPending} className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs flex-1">
            <option value="">Update status</option>
            {Object.entries(REPLACEMENT_PIPELINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
        </form>
      )}
    </Section>
  )
}

function CustomerNotificationSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition()
  if (termination.workflowStatus !== 'UNDER_DOCUMENTATION' || !canEdit) return null
  const replacementOk = termination.replacementRequest && ['APPROVED', 'NOT_APPLICABLE'].includes(termination.replacementRequest.pipelineStatus)
  if (!replacementOk) return null

  return (
    <Section title="Customer Notification">
      <Button type="button" size="sm" disabled={isPending} onClick={() => startTransition(() => logCustomerNotification(termination.id))}>
        Log Customer Notification &amp; Send Exit Survey
      </Button>
    </Section>
  )
}

function ExitClearanceSection({
  termination,
  canEdit,
  approvableDepartments,
}: {
  termination: ResignationData
  canEdit: boolean
  approvableDepartments: string[]
}) {
  const [isPending, startTransition] = useTransition()
  if (termination.clearanceApprovals.length > 0) {
    return (
      <Section title="Exit Clearance">
        <ResignationClearanceBoard approvals={termination.clearanceApprovals} approvableDepartments={new Set(approvableDepartments)} />
      </Section>
    )
  }
  if (termination.workflowStatus !== 'EXIT_SURVEY_PENDING' || !canEdit) return null
  if (!termination.exitSurvey?.completed) {
    return (
      <Section title="Exit Clearance">
        <p className="text-xs text-muted-foreground">Waiting on the Exit Survey to be completed (BR-05).</p>
      </Section>
    )
  }
  return (
    <Section title="Exit Clearance">
      <Button type="button" size="sm" disabled={isPending} onClick={() => startTransition(() => initiateExitClearance(termination.id))}>
        Initiate Exit Clearance
      </Button>
    </Section>
  )
}

function ComplianceReviewSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition()
  if (termination.complianceReview?.overallResult) {
    return (
      <Section title="Compliance Review">
        <Badge variant={termination.complianceReview.overallResult === 'PASS' ? 'default' : 'destructive'} className="text-[10px]">
          {termination.complianceReview.overallResult}
        </Badge>
      </Section>
    )
  }
  if (termination.workflowStatus !== 'COMPLIANCE_REVIEW_PENDING' || !canEdit) return null

  return (
    <Section title="Compliance Review">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          startTransition(() => submitComplianceReview(termination.id, fd))
        }}
      >
        {COMPLIANCE_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" name={item.key} value="true" disabled={isPending} />
            {item.label}
          </label>
        ))}
        <select name="flaggedDepartment" disabled={isPending} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs">
          <option value="">If flagging, which department needs to re-clear? (optional)</option>
          {Object.entries(EXIT_CLEARANCE_DEPARTMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={isPending}>
          Submit Review
        </Button>
      </form>
    </Section>
  )
}

function FinalPayoutSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [amount, setAmount] = useState('')
  const [isPending, startTransition] = useTransition()
  if (!termination.finalPayout) return null

  if (termination.finalPayout.status === 'PROCESSED') {
    return (
      <Section title="Final Payout">
        <p className="text-xs">
          ₱{termination.finalPayout.amount?.toLocaleString()} processed{' '}
          {termination.finalPayout.processedAt && format(new Date(termination.finalPayout.processedAt), 'MMM dd, yyyy')}
        </p>
      </Section>
    )
  }

  return (
    <Section title="Final Payout">
      <p className="text-xs text-muted-foreground mb-2">
        SLA due{' '}
        {termination.finalPayout.slaDueDate && format(new Date(termination.finalPayout.slaDueDate), 'MMM dd, yyyy')}
      </p>
      {canEdit && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            disabled={isPending}
            className="h-8 text-xs w-32"
          />
          <Button
            type="button"
            size="sm"
            disabled={isPending || !amount}
            onClick={() => {
              const fd = new FormData()
              fd.set('amount', amount)
              startTransition(() => recordFinalPayout(termination.id, fd))
            }}
          >
            Record Payout
          </Button>
        </div>
      )}
    </Section>
  )
}

function TrainingSection({ termination, canEdit }: { termination: ResignationData; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition()
  if (termination.workflowStatus !== 'COMPLETED' || !termination.assignmentId || termination.trainingPassedAt) return null

  return (
    <Section title="Training / Reassignment">
      <p className="text-xs text-muted-foreground mb-2">VA remains engaged elsewhere pending the reassignment training gate.</p>
      {canEdit && (
        <Button type="button" size="sm" disabled={isPending} onClick={() => startTransition(() => markTrainingPassed(termination.id))}>
          Mark Training Passed
        </Button>
      )}
    </Section>
  )
}
