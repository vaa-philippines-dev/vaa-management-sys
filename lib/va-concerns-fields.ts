// Labels, row types and the concern taxonomy for /va-concerns — the DMF
// sheet's "VA Concerns" tab. Prisma reads and access rules live in
// lib/va-concerns.ts; this file stays importable from client components.

export const CONCERN_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under review',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
}

// The sheet's ESCALATION STATUS only ever uses these three.
export const ESCALATION_STATUS_OPTIONS = ['PENDING', 'UNDER_REVIEW', 'RESOLVED'] as const

export const ESCALATION_LABELS: Record<string, string> = {
  MANAGER: 'Dept/Ops Manager',
  HR: 'HR',
  CLIENT_EXPERIENCE: 'Client Experience',
  BUSINESS_PROCESS: 'Business Process',
  ACCOUNTING: 'Accounting',
}

// TYPE OF CONCERN → CONCERN, from the Executive Assistant DMF's "VA Concerns
// Guide" tab (the most complete of the seven sheets' lists). Offered as
// suggestions, not enforced: imported rows keep their own wording, and
// "Other" takes free text.
export const CONCERN_TAXONOMY: Record<string, string[]> = {
  'Performance & Productivity': [
    'Low productivity',
    'Missed deadlines',
    'Incomplete tasks',
    'Quality of work issues',
    'Repeated errors',
  ],
  'Attendance & Reliability': [
    'Absences/Unreported absences',
    'Schedule conflicts',
    'Tardiness',
    'Inconsistent work hours',
    'Failure to log hours',
  ],
  'Communication Issues': [
    'Unresponsive to client',
    'Unresponsive to team/TL',
    'Delayed responses',
    'Lack of updates',
    'Miscommunication',
  ],
  'Client-Related Concerns': [
    'Negative client feedback',
    'Client complaints',
    'Client-VA mismatch',
    'Scope misunderstanding',
    'Client escalation',
  ],
  'Behavioral / Professionalism': [
    'Unprofessional behavior',
    'Inappropriate workplace conduct',
    'Resistance to feedback',
    'Attitude concerns',
    'Lack of accountability',
    'Policy violations',
  ],
  'Process & Compliance': [
    'Failure to follow SOPs',
    'Incomplete documentation',
    'Missed reports (WR, trackers, etc.)',
    'Non-compliance with requirements',
  ],
  'Training & Skill Gaps': ['Needs upskilling', 'Tool/system knowledge gap', 'Task unfamiliarity', 'Onboarding gaps'],
  'Workload & Capacity': ['VA burnout', 'Overcapacity', 'Underutilization', 'Struggling with workload'],
  'Technical Issues': ['Internet/connectivity issues', 'System/tool issues', 'Hardware problems'],
  'Administrative / HR-Related': [
    'WR concerns',
    'Pay/Payoneer concerns',
    'Contract issues',
    'Benefits inquiry',
    'HR policy concerns',
  ],
  'Internal Team Concerns': ['Communication issues within internal team'],
  Resignations: [
    'VA: Health and Personal Reasons',
    'VA: Career Opportunities',
    'VA: Career Change',
    'VA: Workload',
  ],
  EOCs: ['Client: Performance Issues', 'Client: Business Decision', 'Client: Relationship and Communication'],
}

export const CONCERN_CATEGORIES = Object.keys(CONCERN_TAXONOMY)

export function formatConcernNumber(n: number): string {
  return `VC-${String(n).padStart(4, '0')}`
}

// What the viewer may change on one concern. The Team Leader keeps the
// first part of the row (the concern itself and their own action); the
// department's managers, HR and admins own the whole row, including the
// manager and escalation columns.
export type ConcernPermissions = {
  canEditConcern: boolean
  canEditManagerFields: boolean
  canDelete: boolean
}

export type ConcernRow = {
  id: string
  number: number
  departmentId: string
  departmentName: string
  vaProfileId: string
  vaName: string
  clientId: string | null
  clientName: string | null
  concernDate: string
  category: string
  concern: string | null
  description: string | null
  suggestedMitigation: string | null
  status: string
  escalatedTo: string | null
  escalationStatus: string | null
  teamLeaderAction: string | null
  managerAction: string | null
  hrAction: string | null
  clientExperienceAction: string | null
  businessProcessAction: string | null
  accountingAction: string | null
  referenceUrl: string | null
  recordingUrl: string | null
  escalationReference: string | null
  sheetConcernId: string | null
  reportedByName: string | null
  resolvedAt: string | null
  updatedAt: string
  permissions: ConcernPermissions
}

// One VA a concern can be raised about, in one department, with the clients
// they currently work for there (the NAME OF CLIENT picker).
export type ConcernVaOption = {
  key: string // vaProfileId:departmentId
  vaProfileId: string
  name: string
  departmentId: string
  departmentName: string
  clients: { id: string; name: string }[]
}
