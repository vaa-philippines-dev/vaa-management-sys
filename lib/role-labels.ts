// Client-safe SystemRole label map — shared by ProfileCard, ViewAsBanner, and anywhere
// else that needs to render a SystemRole for humans. Keep free of server-only imports
// (prisma, next/headers) since client components import this directly.
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
