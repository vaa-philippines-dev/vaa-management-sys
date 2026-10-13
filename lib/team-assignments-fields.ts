import type { VAAssignmentState } from '@/lib/team-assignments'

// Status labels/tones for the Team Assignment view, split from
// lib/team-assignments.ts (Prisma) so client components can import them.

export const STATE_TONE: Record<VAAssignmentState, 'success' | 'info' | 'warning'> = {
  ACTIVE: 'success',
  IDLE: 'info',
  UNAVAILABLE: 'warning',
}

export const STATE_LABEL: Record<VAAssignmentState, string> = {
  ACTIVE: 'Active',
  IDLE: 'Idle',
  UNAVAILABLE: 'Unavailable',
}
