// Client-safe labels and option lists for the Staff Masterlist. Prisma reads
// live in lib/staff.ts — kept apart so 'use client' components can import this
// without Turbopack following Prisma into `pg`.

export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

// StaffRecord statuses are the sheet's own text, not GeneralStatus.
export const STAFF_STATUS_OPTIONS = ['ACTIVE', 'ON HOLD', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'INACTIVE'] as const
export const STAFF_EMPLOYMENT_OPTIONS = ['EMPLOYED', 'PROMOTED', 'TRANSFERRED', 'END OF CONTRACT'] as const
// Statuses that mean the person is no longer working as staff.
export const STAFF_OFFBOARDED_STATUSES = new Set(['RESIGNED', 'REMOVED', 'TRANSFERRED', 'INACTIVE'])

export const STAFF_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  'ON HOLD': 'warning',
  TRANSFERRED: 'info',
  RESIGNED: 'destructive',
  REMOVED: 'destructive',
  INACTIVE: 'neutral',
}

export const STAFF_EMPLOYMENT_TONE: Record<string, Tone> = {
  EMPLOYED: 'success',
  PROMOTED: 'info',
  TRANSFERRED: 'warning',
  'END OF CONTRACT': 'warning',
}

// Offboarding outcomes. RETURN_TO_VA ends the staff engagement and moves the
// person back onto the VA Masterlist (their account becomes a VA account).
export const STAFF_OFFBOARD_OUTCOMES = [
  { value: 'RESIGNED', label: 'Resigned (voluntary)' },
  { value: 'REMOVED', label: 'Removed (involuntary)' },
  { value: 'RETURN_TO_VA', label: 'Back to VA — demote to the VA Masterlist' },
] as const

export const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

// Active, then On Hold, above every inactive status — the VA Masterlist's
// ordering when no status filter is set.
export const staffStatusTier = (status: string | null) => (status === 'ACTIVE' ? 0 : status === 'ON HOLD' ? 1 : 2)
