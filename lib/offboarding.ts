// Single source of truth for offboarding-related labels — previously
// duplicated across TerminationPanel.tsx, VAProfileEditor.tsx, and
// vas/actions.ts. "Termination"/"Terminate" is the internal identifier
// (model, enum, function names) per the 2026-08-12 Workforce Management
// System meeting; "Offboarding"/"Offboard" is the user-facing term.
export const OFFBOARDING_TYPE_LABELS: Record<string, string> = {
  EOC: 'Type A — End of Contract',
  CLIENT_INITIATED: 'Type B — Client-Initiated Removal',
  VAA_INITIATED: 'Type C — VAA-Initiated',
}

export const OFFBOARDING_TYPE_OPTIONS = Object.entries(OFFBOARDING_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

// FB-0006: the official Exit Clearance Form's "TYPE OF SEPARATION" checkboxes —
// a manual reclassification independent of OFFBOARDING_TYPE_LABELS above.
export const SEPARATION_OUTCOME_LABELS: Record<string, string> = {
  CUSTOMER_RESIGNATION_ONLY: 'Customer Resignation Only',
  EOC_TOC: 'EOC | TOC',
  CUSTOMER_AND_OR_VAA_RESIGNATION: 'Customer and/or VAA Philippines Resignation',
  COMPANY_INITIATED_REMOVAL: 'Company-initiated Removal',
  AWOL: 'AWOL',
  UNRESPONSIVE: 'Unresponsive',
  OTHER: 'Other',
}

export const SEPARATION_OUTCOME_OPTIONS = Object.entries(SEPARATION_OUTCOME_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export const REHIRE_ELIGIBILITY_LABELS: Record<string, string> = {
  YES: 'Yes',
  NO: 'No',
  SUBJECT_TO_MANAGEMENT_REVIEW: 'Subject to Management Review',
}

export const REHIRE_ELIGIBILITY_OPTIONS = Object.entries(REHIRE_ELIGIBILITY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export const OFFBOARDING_WORKFLOW_LABELS: Record<string, string> = {
  INITIATED: 'Initiated',
  PENDING_LETTER: 'Awaiting Resignation Letter',
  UNDER_DOCUMENTATION: 'Under Documentation',
  EXIT_SURVEY_PENDING: 'Awaiting Exit Survey',
  CLEARANCE_PENDING: 'Awaiting Clearance',
  CLEARANCE_PROCESSING: 'Exit Clearance Processing',
  COMPLIANCE_REVIEW_PENDING: 'Awaiting Compliance Review',
  PAYOUT_PENDING: 'Payout Pending (SLA Active)',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const EXIT_CLEARANCE_DEPARTMENT_LABELS: Record<string, string> = {
  SERVICE_DEPARTMENT: 'Service Department',
  CUSTOMER_SUCCESS: 'Customer Success',
  TRAINING: 'Training',
  ACCOUNTING: 'Accounting',
  HR: 'Human Resources',
}

export const CLEARANCE_APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const REPLACEMENT_PIPELINE_LABELS: Record<string, string> = {
  SOURCED: 'Sourced',
  ENDORSED: 'Endorsed',
  INTERVIEWED: 'Client-Interviewed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  NOT_APPLICABLE: 'Not Applicable',
}

// The department-specific checklist items from the paper Exit Clearance Form
// (kept out of the DB schema since wording may change — see
// ExitClearanceApproval.checklistItems).
export const DEPARTMENT_CHECKLISTS: Record<string, string[]> = {
  SERVICE_DEPARTMENT: [
    'All assigned tasks completed',
    'Work turnover completed (logins, company files, credentials, outstanding accountabilities)',
    'Shadowing completed (if applicable)',
    'Removed from communication channels (WhatsApp GC and other Departmental GC, etc)',
  ],
  CUSTOMER_SUCCESS: [
    'Customer notified',
    'Customer offboarding completed (for TOC only)',
    'Customer credentials revoked',
  ],
  TRAINING: [
    'Training obligations completed',
    'Assessment completed (if applicable)',
    'Training platform access revoked',
    'Training materials returned (if applicable)',
  ],
  ACCOUNTING: [
    'Outstanding loan obligations verified',
    'Attendance verified',
    'Final payout computed',
    'Final payout endorsed',
  ],
  HR: [
    'Exit survey verified',
    'Removed access to internal VAA systems and files (if applicable) (Masterlist, Masterlist Folder, 201, Payroll, Students Place)',
    'Device/equipment returned (if applicable)',
  ],
}
