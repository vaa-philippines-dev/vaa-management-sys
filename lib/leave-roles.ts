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
