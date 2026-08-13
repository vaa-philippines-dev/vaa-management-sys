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

export const OFFBOARDING_WORKFLOW_LABELS: Record<string, string> = {
  INITIATED: 'Initiated',
  EXIT_SURVEY_PENDING: 'Awaiting Exit Survey',
  CLEARANCE_PENDING: 'Awaiting Clearance',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}
