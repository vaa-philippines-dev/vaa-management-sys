// Shared between the leave-hierarchy admin UI and its Server Actions.
// VAs are out of scope for Staff Leave Management (separate contract/
// availability model on VAProfile) — every other SystemRole may both
// submit leave and be configured as an approver.
export const LEAVE_ROLE_OPTIONS = [
  'SUPER_ADMIN',
  'SYSTEM_ADMIN',
  'EXECUTIVE',
  'DEPT_MANAGER',
  'TEAM_LEADER',
  'OPERATIONS_MANAGER',
  'HR',
  'STAFF',
] as const

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  EXECUTIVE: 'Executive',
  DEPT_MANAGER: 'Dept Manager',
  TEAM_LEADER: 'Team Leader',
  OPERATIONS_MANAGER: 'Operations Manager',
  HR: 'HR',
  STAFF: 'Staff',
  VA: 'Virtual Assistant',
}

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  EMERGENCY: 'Emergency',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  UNPAID: 'Unpaid',
  BEREAVEMENT: 'Bereavement',
}

export const LEAVE_STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-warning/15 text-warning border-warning/20',
  APPROVED: 'bg-success/15 text-success border-success/20',
  REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
  CANCELLED: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
}
